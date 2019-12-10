import {
  JsonRpcError,
  JsonRpcErrorCode,
  JsonRpcMessage,
  JsonRpcMessageId,
  JsonRpcMessageParams,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from './jsonRpcApi';
import {
  JsonRpcExpectedParams,
  JsonRpcExposedMethod,
  JsonRpcMethodHandler,
  JsonRpcMethodResponse,
  JsonRpcNotificationListener,
} from './jsonRpcDispatcherTypes';
import {JsonRpcTransportAdapter} from './jsonRpcTransportAdapter';

const JSON_RPC_VERSION = '2.0';
const PARSE_ERROR_EMISSION_THROTTLE_TIME = 500; // ms

export interface Logger {
  error(message: string): void;
}

export interface JsonRpcDispatcherOptions {
  messageIdFactory?: () => JsonRpcMessageId;
  logger?: Logger;
}

/**
 * JSON-RPC 2.0 Specification (http://www.jsonrpc.org/specification).
 *
 * Currently the dispatcher does not conform to the specification:
 * - not supported batch requests (sending, processing);
 * - not strict validation of incoming messages.
 */
export class JsonRpcDispatcher {
  private readonly logger: Logger;

  private readonly transportSubscriptions = new SubscriptionSink();
  private readonly pendingRequests = new Map<
    JsonRpcMessageId,
    ResultLatch<JsonRpcMethodResponse>
  >();
  private readonly exposedMethods = new Map<string, JsonRpcExposedMethod>();
  private readonly notificationListeners = new Map<
    string,
    JsonRpcNotificationListener
  >();
  private messageIdCounter = 0;
  private transport: JsonRpcTransportAdapter;
  private readonly messageIdFactory: () => JsonRpcMessageId;
  private readonly parseErrorMessageEmitter = new Emitter<void>();

  constructor(options: JsonRpcDispatcherOptions = {}) {
    const {
      messageIdFactory = () => this.defaultMessageIdFactory(),
      logger = {error: () => undefined},
    } = options;
    this.messageIdFactory = messageIdFactory;
    this.logger = logger;
  }

  get isConnected(): boolean {
    return !!this.transport;
  }

  get hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }

  async connect(transport: JsonRpcTransportAdapter) {
    if (this.transport) {
      await this.disconnect();
    }
    this.transport = transport;
    this.transportSubscriptions
      .add(this.transport.addListener(message => this.dispatchMessage(message)))
      .add(
        Publishers.take(this.parseErrorMessageEmitter)
          .apply(Transformers.throttleTime(PARSE_ERROR_EMISSION_THROTTLE_TIME))
          .subscribe(() => this.sendParseErrorMessage()),
      );
  }

  async disconnect() {
    this.transportSubscriptions.unsubscribe();
    this.transport = null;
    this.terminateAllPendingRequests();
  }

  exposeMethod(definition: JsonRpcExposedMethod) {
    this.exposedMethods.set(definition.method, definition);
  }

  exposeMethodWithArgs(
    method: string,
    args: number | boolean,
    handler: JsonRpcMethodHandler,
  ) {
    this.exposedMethods.set(method, {
      method,
      params: {positionalParams: args},
      handler,
    });
  }

  disposeMethod(method: string) {
    this.exposedMethods.delete(method);
  }

  disposeAllMethods() {
    this.exposedMethods.clear();
  }

  registerListener(listener: JsonRpcNotificationListener) {
    this.notificationListeners.set(listener.method, listener);
  }

  removeListener(method: string) {
    this.notificationListeners.delete(method);
  }

  removeAllListeners() {
    this.notificationListeners.clear();
  }

  /** @experimental */
  disposeAll() {
    this.disposeAllMethods();
    this.removeAllListeners();
  }

  async request(
    method: string,
    params?: JsonRpcMessageParams,
  ): Promise<JsonRpcMethodResponse> {
    const id = this.messageIdFactory();
    const request: JsonRpcRequest = {jsonrpc: JSON_RPC_VERSION, id, method};
    if (params) {
      request.params = params;
    }
    const resultLatch = new ResultLatch<JsonRpcMethodResponse>();
    this.pendingRequests.set(id, resultLatch);
    this.sendMessage(request);
    return resultLatch.wait();
  }

  /**
   * @throws JsonRpcInvocationException
   */
  async invoke(method: string, params?: JsonRpcMessageParams): Promise<any> {
    const response = await this.request(method, params);
    if (response.error) {
      throw new JsonRpcInvocationException(
        'Failed to invoke RPC method: ' + method,
        response.error,
      );
    }
    return response.result;
  }

  async notify(method: string, params?: JsonRpcMessageParams) {
    const request: JsonRpcNotification = {jsonrpc: JSON_RPC_VERSION, method};
    if (params) {
      request.params = params;
    }
    this.sendMessage(request);
  }

  private sendMessage(message: JsonRpcMessage) {
    const jsonMessage = JSON.stringify(message);
    this.transport.sendMessage(jsonMessage);
  }

  private dispatchMessage(jsonMessage: string) {
    let message: JsonRpcMessage = null;
    try {
      message = JSON.parse(jsonMessage);
    } catch (error) {
      this.logger.captureError(
        error,
        'Failed to parse JSON RPC message',
        jsonMessage,
      );
      this.parseErrorMessageEmitter.emit();
    }
    if (!message) {
      return;
    }

    if (message.id && message.method) {
      this.onRequest(message as JsonRpcRequest);
    } else if (message.id && !message.method) {
      this.onResponse(message as JsonRpcResponse);
    } else if (!message.id && message.method) {
      this.onNotification(message as JsonRpcNotification);
    }
  }

  private sendParseErrorMessage() {
    this.sendMessage(ParseErrorMessage);
  }

  private async onNotification(notification: JsonRpcNotification) {
    const listener = this.notificationListeners.get(notification.method);
    if (!listener) {
      return;
    }

    const validationErrorResponse = this.validateRequestParams(
      notification.params,
      listener.params,
    );
    if (validationErrorResponse) {
      return;
    }

    try {
      await listener.handler(notification.params);
    } catch (error) {
      this.logger.captureError(
        error,
        'Error during invocation of a notification listener',
      );
    }
  }

  private async onRequest(request: JsonRpcRequest) {
    const exposedMethod = this.exposedMethods.get(request.method);
    if (!exposedMethod) {
      this.sendMessage(RpcErrors.createMethodNotFoundResponse(request.id));
      return;
    }

    const requestResponse: JsonRpcResponse = {
      jsonrpc: JSON_RPC_VERSION,
      id: request.id,
    };

    const validationErrorResponse = this.validateRequestParams(
      request.params,
      exposedMethod.params,
    );
    if (validationErrorResponse) {
      requestResponse.error = validationErrorResponse;
      this.sendMessage(requestResponse);
      return;
    }

    try {
      const methodResponse: JsonRpcMethodResponse = {};
      const directResult: any = await exposedMethod.handler(
        request.params,
        methodResponse,
      );

      if (Values.isDefined(methodResponse.error)) {
        requestResponse.error = methodResponse.error;
      } else if (directResult !== undefined) {
        requestResponse.result = directResult;
      } else {
        requestResponse.result = methodResponse.result;
      }
    } catch (error) {
      this.logger.captureError(error, 'Error during invocation of a method');
      requestResponse.error = {
        code: JsonRpcErrorCode.InternalError,
        message: 'Error during invocation of a method',
      };
    }
    this.sendMessage(requestResponse);
  }

  private onResponse(response: JsonRpcResponse) {
    const latch = this.pendingRequests.get(response.id);
    if (latch) {
      this.pendingRequests.delete(response.id);
      latch.release(response);
    }
  }

  private terminateAllPendingRequests() {
    const terminationError: JsonRpcError = {
      code: JsonRpcErrorCode.InternalError,
      message: 'JsonRpcDispatcher was disconnected',
    };
    this.pendingRequests.forEach(latch => {
      try {
        latch.reject(terminationError);
      } catch (error) {
        this.logger.captureError(
          error,
          'Failed to terminate a pending request',
        );
      }
    });
    this.pendingRequests.clear();
  }

  private defaultMessageIdFactory(): JsonRpcMessageId {
    this.messageIdCounter++;
    if (this.messageIdCounter >= Number.MAX_SAFE_INTEGER) {
      this.messageIdCounter = 0;
    }
    return this.messageIdCounter;
  }

  private validateRequestParams(
    params: JsonRpcMessageParams,
    expected: JsonRpcExpectedParams | boolean | null,
  ): JsonRpcError | null {
    if (!expected) {
      return null;
    }

    const isArray = Values.isArray(params);
    const isObject = Values.isObject(params);

    if (expected === true) {
      return isArray || isObject ? null : INVALID_PARAMS_ERROR;
    } else if (
      expected.positionalParams === true ||
      expected.positionalParams === 0 ||
      expected.positionalParams > 0
    ) {
      if (!isArray) {
        return expected.positionalParams === 0 ? null : INVALID_PARAMS_ERROR;
      }
      const positionalParams = params as any[];
      if (
        expected.positionalParams !== true &&
        expected.positionalParams > positionalParams.length
      ) {
        return INVALID_PARAMS_ERROR;
      }
    } else if (expected.namedParams) {
      if (!isObject) {
        return INVALID_PARAMS_ERROR;
      }
      if (Values.isArray(expected.namedParams)) {
        const namedParams = params as {};
        const invalid = expected.namedParams.some(
          key => namedParams[key] === undefined,
        );
        if (invalid) {
          return INVALID_PARAMS_ERROR;
        }
      }
    }

    return null;
  }
}

const ParseErrorMessage: Readonly<JsonRpcMessage> = {
  jsonrpc: JSON_RPC_VERSION,
  id: null,
  error: {
    code: JsonRpcErrorCode.ParseError,
    message: 'Parse error',
  },
};

const INVALID_PARAMS_ERROR: Readonly<JsonRpcError> = {
  code: JsonRpcErrorCode.InvalidParams,
  message: 'Invalid params',
};

function createMethodNotFoundResponse(
  requestId: JsonRpcMessageId,
): Readonly<JsonRpcResponse> {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id: requestId,
    error: {
      code: JsonRpcErrorCode.MethodNotFound,
      message: 'Method not found',
    },
  };
}

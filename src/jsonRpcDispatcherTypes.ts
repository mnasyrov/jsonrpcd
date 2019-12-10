import {JsonRpcError, JsonRpcMessageParams} from './jsonRpcApi';

export interface JsonRpcMethodResponse {
  result?: any;
  error?: JsonRpcError;
}

export type JsonRpcMethodHandler = (
  params: JsonRpcMessageParams | null,
  response: JsonRpcMethodResponse,
) => Promise<any>;

export interface JsonRpcExpectedParams {
  positionalParams?: boolean | number;
  namedParams?: boolean | string[];
}

export type JsonRpcNotificationHandler = (
  params: JsonRpcMessageParams | null,
) => any;

export interface JsonRpcNotificationListener {
  method: string;
  params?: JsonRpcExpectedParams | true | null;
  handler: JsonRpcNotificationHandler;
}

export interface JsonRpcDispatcherTypes {
  method: string;
  params?: JsonRpcExpectedParams | true | null;
  handler: JsonRpcNotificationHandler;
}

export interface JsonRpcExposedMethod {
  method: string;
  params?: JsonRpcExpectedParams | boolean | null;
  handler: JsonRpcMethodHandler;
}

export class JsonRpcInvocationError extends Error {
  readonly cause?: Error | string;

  constructor(message: string, cause?: Error | string) {
    const targetPrototype = new.target.prototype;
    if (cause) {
      const causeMessage =
        typeof cause === 'string' ? String(cause) : cause.message;
      if (causeMessage) {
        message = message ? message + ' >>> ' + causeMessage : causeMessage;
      }
    }
    super(message);
    this.cause = cause;
    this.name = 'JsonRpcInvocationError';
    Object.setPrototypeOf(this, targetPrototype);
  }
}

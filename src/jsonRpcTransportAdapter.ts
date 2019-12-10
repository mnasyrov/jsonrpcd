export interface JsonRpcTransportAdapterSubscription {
  unsubscribe(): void;
}

export interface JsonRpcTransportAdapter {
  sendMessage(message: string): void;

  addListener(
    listener: (message: string) => void,
  ): JsonRpcTransportAdapterSubscription;
}

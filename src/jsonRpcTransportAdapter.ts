import {SimpleSubscription} from '@mnt-libs/stdlib/src/pubsub/simpleSubscription';

export interface JsonRpcTransportAdapter {
  sendMessage(message: string): void;

  addListener(listener: (message: string) => void): SimpleSubscription;
}

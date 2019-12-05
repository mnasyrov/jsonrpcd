import {JsonRpcTransportAdapter} from '@mnt-libs/jsonrpc/src/jsonRpcTransportAdapter';
import {Emitter} from '@mnt-libs/stdlib/src/pubsub/emitter';
import {Publisher} from '@mnt-libs/stdlib/src/pubsub/publisher';

export class MessageChannelSimulator {
    private readonly subject1 = new Emitter<string>();
    private readonly subject2 = new Emitter<string>();

    readonly port1: JsonRpcTransportAdapter = {
        sendMessage: message => this.subject2.emit(message),
        addListener: listener => this.subject1.subscribe(listener)
    };

    readonly port2: JsonRpcTransportAdapter = {
        sendMessage: message => this.subject1.emit(message),
        addListener: listener => this.subject2.subscribe(listener)
    };

    get port1Values(): Publisher<string> {
        return this.subject1;
    }

    get port2Values(): Publisher<string> {
        return this.subject2;
    }
}

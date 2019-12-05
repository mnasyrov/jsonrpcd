import {expect} from 'chai';
import {JsonRpcDispatcher} from '@mnt-libs/jsonrpc/src/jsonRpcDispatcher';
import {MessageChannelSimulator} from '@mnt-libs/jsonrpc/src/messageChannelSimulator';

describe('JsonRpcDispatcher', () => {
    describe('#smoke tests', () => {
        it('should send and listen RPC messages', async () => {
            const channel = new MessageChannelSimulator();

            const rpc1 = new JsonRpcDispatcher();
            await rpc1.connect(channel.port1);

            const rpc2 = new JsonRpcDispatcher();
            await rpc2.connect(channel.port2);

            let counter1 = 0;
            let sum2 = 0;
            rpc1.exposeMethodWithArgs('rpc1.add', 1, (params) => counter1 += params[0]);

            rpc2.exposeMethod({
                method: 'rpc2.sum',
                params: {positionalParams: 2},
                handler: params => sum2 = params[0] + params[1]
            });

            const addResponse = await rpc2.request('rpc1.add', [2]);
            expect(addResponse.result).to.be.equal(2);
            expect(counter1).to.be.equal(2);

            const sumResponse = await rpc1.request('rpc2.sum', [1, 2]);
            expect(sumResponse.result).to.be.equal(3);
            expect(sum2).to.be.equal(3);
        });

        it('should send RPC notifications', async () => {
            const channel = new MessageChannelSimulator();

            const rpc1 = new JsonRpcDispatcher();
            await rpc1.connect(channel.port1);

            const rpc2 = new JsonRpcDispatcher();
            await rpc2.connect(channel.port2);

            let counter = 0;
            rpc1.registerListener({method: 'rpc1.onMessage', handler: () => counter++});
            await rpc2.notify('rpc1.onMessage');
            expect(counter).to.be.equal(1);
        });
    });
});

import {JsonRpcExpectedParams} from '@mnt-libs/jsonrpc/src/common/jsonRpcExpectedParams';
import {JsonRpcNotificationHandler} from '@mnt-libs/jsonrpc/src/common/jsonRpcNotificationHandler';

export interface JsonRpcNotificationListener {
    method: string;
    params?: JsonRpcExpectedParams | true | null;
    handler: JsonRpcNotificationHandler;
}


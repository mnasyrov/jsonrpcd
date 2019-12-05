import {JsonRpcExpectedParams} from '@mnt-libs/jsonrpc/src/common/jsonRpcExpectedParams';
import {JsonRpcMethodHandler} from '@mnt-libs/jsonrpc/src/common/jsonRpcMethodHandler';

export interface JsonRpcExposedMethod {
    method: string;
    params?: JsonRpcExpectedParams | boolean | null;
    handler: JsonRpcMethodHandler;
}



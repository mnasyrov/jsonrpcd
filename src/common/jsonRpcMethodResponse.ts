import {JsonRpcError} from '@mnt-libs/jsonrpc/src/common/jsonRpcTypes';

export interface JsonRpcMethodResponse {
    result?: any;
    error?: JsonRpcError;
}

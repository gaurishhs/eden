import type { Elysia } from 'elysia'
import type { EdenWS } from './index'
import type {
    IsUnknown,
    IsNever,
    IsAny,
    UnionToIntersect,
    MapError
} from '../types'
import type { EdenFetchError } from '../errors'

type Files = File | FileList

type Replace<RecordType, TargetType, GenericType> = {
    [K in keyof RecordType]: RecordType[K] extends TargetType
        ? GenericType
        : RecordType[K]
}

type Split<S extends string> = S extends `${infer Head}/${infer Tail}`
    ? Head extends ''
        ? Tail extends ''
            ? []
            : Split<Tail>
        : [Head, ...Split<Tail>]
    : S extends `/`
    ? []
    : S extends `${infer Head}/`
    ? [Head]
    : [S]

type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}

type AnySchema = {
    body: unknown
    headers: Record<string, any> | undefined
    query: Record<string, any> | undefined
    params: Record<string, any> | undefined
    response: any
}

export namespace EdenTreaty {
    export type Create<App extends Elysia<any, any>> = App['meta'] extends {
        schema: infer Schema extends Record<string, any>
    }
        ? UnionToIntersect<Sign<Schema>>
        : 'Please install Elysia before using Eden'

    export interface Config {
        /**
         * Default options to pass to fetch
         */
        $fetch?: RequestInit
        fetcher?: typeof fetch
    }

    export type Sign<
        Schema extends Record<string, Record<string, unknown>>,
        // @ts-ignore
        Paths extends (string | number)[] = Split<keyof Schema>,
        Carry extends string = ''
    > = Paths extends [
        infer Prefix extends string | number,
        ...infer Rest extends (string | number)[]
    ]
        ? {
              [Key in Prefix as Prefix extends `:${string}`
                  ? (string & {}) | number | Prefix
                  : Prefix]: Sign<Schema, Rest, `${Carry}/${Key}`>
          }
        : Schema[Carry extends '' ? '/' : Carry] extends infer Routes
        ? {
              [Method in keyof Routes]: Routes[Method] extends infer Route extends AnySchema
                  ? Method extends 'subscribe'
                      ? undefined extends Route['query']
                          ? (params?: {
                                $query?: Record<string, string>
                            }) => EdenWS<Route>
                          : (params: {
                                $query: Route['query']
                            }) => EdenWS<Route>
                      : ((
                            params: {
                                $fetch?: RequestInit
                            } & (IsUnknown<Route['body']> extends false
                                ? Replace<Route['body'], Blob | Blob[], Files>
                                : {}) &
                                (undefined extends Route['query']
                                    ? {
                                          $query?: Record<string, string>
                                      }
                                    : {
                                          $query: Route['query']
                                      }) &
                                (undefined extends Route['headers']
                                    ? {
                                          $headers?: Record<string, unknown>
                                      }
                                    : {
                                          $headers: Route['headers']
                                      })
                        ) => Promise<
                            (
                                | {
                                      data: Route['response'] extends {
                                          200: infer ReturnedType
                                      }
                                          ? Awaited<ReturnedType>
                                          : unknown
                                      error: null
                                  }
                                | {
                                      data: null
                                      error: MapError<
                                          Route['response']
                                      > extends infer Errors
                                          ? IsNever<Errors> extends true
                                              ? EdenFetchError<number, string>
                                              : Errors
                                          : EdenFetchError<number, string>
                                  }
                            ) & {
                                status: number
                                response: Response
                                headers: Record<string, string>
                            }
                        >) extends (params: infer Params) => infer Response
                      ? {
                            $params: undefined
                            $headers: undefined
                            $query: undefined
                        } extends Params
                          ? (params?: Prettify<Params>) => Response
                          : (params: Prettify<Params>) => Response
                      : never
                  : never
          }
        : {}

    export interface OnMessage<Data = unknown> extends MessageEvent {
        data: Data
        rawData: MessageEvent['data']
    }

    export type WSEvent<
        K extends keyof WebSocketEventMap,
        Data = unknown
    > = K extends 'message' ? OnMessage<Data> : WebSocketEventMap[K]
}

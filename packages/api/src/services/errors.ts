export class ServiceError extends Error {
    code: 'NOT_FOUND' | 'CONFLICT' | 'INVALID_SCOPE'

    constructor(code: ServiceError['code'], message: string) {
        super(message)
        this.code = code
    }
}

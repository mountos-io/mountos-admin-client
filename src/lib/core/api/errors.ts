export class ApiError extends Error {
  readonly status: number
  readonly errorCode?: number

  constructor(message: string, status: number, errorCode?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

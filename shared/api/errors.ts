export class ApiClientError extends Error {
  code: string

  constructor(message: string, code = 'API_ERROR') {
    super(message)
    this.code = code
  }
}

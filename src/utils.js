import { getRandomValues } from 'crypto'

export function randomNumber () {
  const array = new Uint32Array(1)
  getRandomValues(array)

  return array[0]
}

export function tryToConvertBufferToJson (buffer) {
  try {
    return JSON.parse(buffer.toString())
  } catch (e) {
    return null
  }
}

export function tryToConvertBufferToString (buffer) {
  try {
    return buffer.toString('utf8')
  } catch (e) {
    return null
  }
}

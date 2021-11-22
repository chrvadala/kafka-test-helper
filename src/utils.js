export function randomNumber () {
  return Math.round(Math.random() * 100_000)
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

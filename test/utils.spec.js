import { randomNumber, tryToConvertBufferToJson, tryToConvertBufferToString } from '../src/utils.js'
import { test, expect } from '@jest/globals'

test('randomNumber', () => {
  const number = randomNumber()
  expect(typeof number).toBe('number')
})

test('tryToConvertBufferToJson', () => {
  const json = tryToConvertBufferToJson(Buffer.from('{"foo": "bar"}'))
  expect(json).toEqual({ foo: 'bar' })

  const json2 = tryToConvertBufferToJson(Buffer.from('{NOT_A_JSON}'))
  expect(json2).toBe(null)
})

test('tryToConvertBufferToString', () => {
  const string = tryToConvertBufferToString(Buffer.from('hello'))
  expect(string).toBe('hello')
})

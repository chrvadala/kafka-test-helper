import { makePlaceholderMessages, isPlaceholderMessage, isPlaceholderMessageWithUUID } from './placeholder.js'

const validPlaceholder = JSON.stringify({
    what_is_that_message: 'https://github.com/chrvadala/kafka-test-helper',
    kafka_test_helper: true,
    uuid: 'test123'
})

const invalidPlaceholder = JSON.stringify({
    bar: "abc",
    foo: 42
})

describe.only("placeholder", () => {

    test("makePlaceholderMessages", () => {
        const placeholder = JSON.stringify({
            what_is_that_message: 'https://github.com/chrvadala/kafka-test-helper',
            kafka_test_helper: 'yes',
            uuid: 'test123'
        })

        const expected = [
            { partition: 0, value: placeholder },
            { partition: 1, value: placeholder },
            { partition: 2, value: placeholder },
            { partition: 3, value: placeholder },
        ]

        const messages = makePlaceholderMessages('test123', 4);

        expect(messages).toMatchSnapshot()
        expect(messages).toEqual(expected)
    })


    test("isPlaceholderMessageWithUUID", () => {
        expect(isPlaceholderMessageWithUUID({ value: validPlaceholder }, 'test123')).toBe(true)
        expect(isPlaceholderMessageWithUUID({ value: validPlaceholder }, 'testabc')).toBe(false)
        expect(isPlaceholderMessageWithUUID({}, 'testabc')).toBe(false)

        expect(isPlaceholderMessageWithUUID({ value: invalidPlaceholder }, 'test123')).toBe(false)

        expect(isPlaceholderMessageWithUUID({ value: "tfsahkh{" }, 'test123')).toBe(false)
        expect(isPlaceholderMessageWithUUID({ value: null }, 'test123')).toBe(false)
    })

    test("isPlaceholderMessageWithUUID", () => {
        expect(isPlaceholderMessage({ value: validPlaceholder })).toBe(true)

        expect(isPlaceholderMessage({ value: invalidPlaceholder })).toBe(false)
        expect(isPlaceholderMessage({})).toBe(false)

        expect(isPlaceholderMessage({ value: "tfsahkh{" })).toBe(false)
        expect(isPlaceholderMessage({ value: null })).toBe(false)
    })
})
import { makePlaceholderMessages, isPlaceholderMessageWithUUID } from './placeholder.js'

describe.only("placeholder", () => {

    test("makePlaceholderMessages", () => {
        const placeholder = JSON.stringify({
            what_is_that_message: 'https://github.com/chrvadala/kafka-test-helper',
            uuid: 'test123'
        })

        const messages = makePlaceholderMessages('test123', 4);

        const expected = [
            { partition: 0, value: placeholder },
            { partition: 1, value: placeholder },
            { partition: 2, value: placeholder },
            { partition: 3, value: placeholder },
        ]

        expect(messages).toMatchSnapshot()
        expect(messages).toEqual(expected)
    })


    test("isPlaceholderMessageWithUUID", () => {
        const placeholder = JSON.stringify({
            what_is_that_message: 'https://github.com/chrvadala/kafka-test-helper',
            uuid: 'test123'
        })

        const invalidPlaceholder = JSON.stringify({
            bar: "abc",
            foo: 42
        })


        expect(isPlaceholderMessageWithUUID(placeholder, 'test123')).toBe(true)
        expect(isPlaceholderMessageWithUUID(placeholder, 'testabc')).toBe(false)

        expect(isPlaceholderMessageWithUUID(invalidPlaceholder, 'test123')).toBe(false)

        expect(isPlaceholderMessageWithUUID("tfsahkh{", 'test123')).toBe(false)
        expect(isPlaceholderMessageWithUUID(null, 'test123')).toBe(false)
    })
})
export const WHAT_IS_THAT_MESSAGE_KEY = 'what_is_that_message'
export const WHAT_IS_THAT_MESSAGE_VALUE = 'https://github.com/chrvadala/kafka-test-helper'

export function makePlaceholderMessages(uuid, partions) {
    const messages = []
    for(let i =0; i<partions; i++){
        messages.push({
            partition: i,
            value: JSON.stringify({
                [WHAT_IS_THAT_MESSAGE_KEY]: WHAT_IS_THAT_MESSAGE_VALUE,
                'kafka_test_helper': 'yes',
                uuid
            })
        })
    }

    return messages;
}

export function isPlaceholderMessage(message) {
    const json = tryToExtractValueFromMessage(message)

    if(!json) return false

    return typeof json === 'object' 
        && json !== null 
        && json.hasOwnProperty('kafka_test_helper')
}

export function isPlaceholderMessageWithUUID(message, uuid) {
    const json = tryToExtractValueFromMessage(message)

    if(!json) return false

    return typeof json === 'object' 
        && json !== null 
        && json.hasOwnProperty('kafka_test_helper')
        && json.hasOwnProperty('uuid')
        && json.uuid === uuid
}

function tryToExtractValueFromMessage(message){
    try{
        return JSON.parse(message.value)
    }catch{
        return false
    }
}

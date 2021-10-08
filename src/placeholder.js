export const WHAT_IS_THAT_MESSAGE_KEY = 'what_is_that_message'
export const WHAT_IS_THAT_MESSAGE_VALUE = 'https://github.com/chrvadala/kafka-test-helper'

export function makePlaceholderMessages(uuid, partions) {
    const messages = []
    for(let i =0; i<partions; i++){
        messages.push({
            partition: i,
            value: JSON.stringify({
                [WHAT_IS_THAT_MESSAGE_KEY]: WHAT_IS_THAT_MESSAGE_VALUE,
                uuid
            })
        })
    }

    return messages;
}

export function isPlaceholderMessageWithUUID(message, uuid) {
    let json;

    try{
        json=JSON.parse(message)
    }catch{
        return false
    }

    return typeof json === 'object' 
        && json !== null 
        && json.hasOwnProperty('uuid')
         && json.uuid === uuid
}


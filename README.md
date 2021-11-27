# kafka-test-helper

Kafka test helper is a Node.js  library that helps you to write integration tests that interacts with Apache Kafka.

[![chrvadala](https://img.shields.io/badge/website-chrvadala-orange.svg)](https://chrvadala.github.io)
[![Test](https://github.com/chrvadala/kafka-test-helper/workflows/Test/badge.svg)](https://github.com/chrvadala/node-ble/actions)
[![Coverage Status](https://coveralls.io/repos/github/chrvadala/kafka-test-helper/badge.svg?branch=master)](https://coveralls.io/github/chrvadala/kafka-test-helper?branch=master)
[![npm](https://img.shields.io/npm/v/kafka-test-helper.svg?maxAge=2592000?style=plastic)](https://www.npmjs.com/package/kafka-test-helper)
[![Downloads](https://img.shields.io/npm/dm/kafka-test-helper.svg)](https://www.npmjs.com/package/kafka-test-helper)
[![Donate](https://img.shields.io/badge/donate-PayPal-green.svg)](https://www.paypal.me/chrvadala/25)


# Features 
This library can:
- read events published on a topic 
- publish events on a channel or a specific partition
- create/delete topic on the fly

Kafka test helper is able to work both with independent messages and messages managed in the context of a transaction (commited or aborted).
You can use Kafka test helper in conjunction with your preferred testing library, because it is compatible with jest, mocha, tap and so on..., by the way it's agnostic by test runners.

# Documentation
- [Architecture](./docs/architecture.md)
- [APIs](./docs/api.md)

# Install
```sh
npm install kafka-test-helper
```
# Examples

## Read messages
- [ ] TODO

## Produce messages
- [ ] TODO

## Create / Delete topics
- [ ] TODO

# Changelog
- **0.x** - Beta version

# Contributors
- [chrvadala](https://github.com/chrvadala) (author)

# References
- https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging
- https://kafka.apache.org/documentation
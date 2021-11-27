# Architecture

Kafka test helper is a Node.js  library that helps you to write integration tests that interacts with Apache Kafka.

Detecting published messages on a topic isn't so easy as you can think, because you can't rely on commit offsets, because of the control messages https://kafka.apache.org/documentation/#controlbatch published in the context of a transaction.

In order to detect published messages, this library publishes some special messages, called **placeholders**.

```
+---+---+---+---+---+
+ M + M + M + M + P +
+---+---+---+---+
+---+---+
+ M + P +
+---+---+
+ M + M + M + P +
+---+---+---+---+

M = Message
P = Placeholder
```

It uses the following technique:
- _Step one_: When you call `messages()` function, this library fills your topic with a special placeholder message (one for partition). A placeholder is a special message that marks current topic's head. Note: Multiple placeholders can exists on a single partition.
- _Step two_: Kafka test helper consumes any published messages from last `reset()` operation to latest placeholder message, then it returns any found message. 
- _Step three_: You can inspect those messages and assert them with your preferred 'expect' library.

If placeholder messages interfers with your code, you can identify and skip them thanks to the following simple function.

```js
    const isPlaceholderMessage = msg => !!msg.kafka_test_helper
```
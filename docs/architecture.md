# Architecture

Detecting published messages on a topic isn't so easy as you can think, because you can't rely on commit offsets, because of the control messages https://kafka.apache.org/documentation/#controlbatch published in the context of a transaction.
In order to detect published messages by your tested function, it uses the following technique.
+---+---+---+---+---+
+ E + E + E + E + P +
+---+---+---+---+---+

It works with leveraging on a two steps approach:
Step one: When you call 'consume messages' function, this library fills your topic with a special placeholder message (one for partition). A placeholder is a special message that marks current topic's head. Multiple placeholders can exist s on a single partition.
Step two: Kafka test helper consumes any published messages from last reset() operation to latest placeholder message, then it returns any found message. You can inspect those messages and assert them with your preferred 'expect' library.

If placeholder messages interfes with your code, you can identify and skip them thanks to the following simple function.
Const skippableMessage = msg => !!msg.kafkaTestHelper
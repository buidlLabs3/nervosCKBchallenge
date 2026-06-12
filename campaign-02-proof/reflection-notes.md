# Reflection Notes - buidlLabs3

Important: CKBoost asks for a reflection in your own words. Use these notes as memory of the actual run, then rewrite them so the final submission sounds like you.

A strong angle for this account is the idea that the out point acts like a bookmark into chain state. The transaction hash alone identifies the transaction, but the tutorial became clearer when the script retrieved output index `0x0` from that transaction and decoded the exact data sitting in that live cell. That made the cell model feel concrete: the message lives at a specific transaction output, not in some global contract storage slot.

The most interesting part was how explicit the workflow is. First the message becomes bytes, then bytes become a hex string, then the hex string is placed in `outputsData`, then the transaction is completed with inputs and fee, and only after commit can the cell be queried back. Each step exposed a different layer of CKB: encoding, transaction construction, capacity funding, and state lookup.

The live-cell retrieval changed how to think about application state on CKB. A live cell is not just a record; it is also spendable state. If a later transaction consumes it, the old out point stops being live and the new output becomes the current state. That is different from the account-model habit of updating a variable in place. It makes state transitions feel more like creating a trail of precise objects.

Possible final reflection direction: focus on how the tutorial made CKB's storage model feel location-based. The message was easy to understand, but the deeper lesson was that an app can organize information around cells and out points, then use RPC queries to recover exactly what was committed.

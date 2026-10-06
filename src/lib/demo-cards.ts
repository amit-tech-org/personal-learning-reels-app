import { makeCardId } from "./ids";
import type { Card, Depth } from "./types";

export interface DemoCard extends Card {
  pool: "main" | "deeper";
}

function seal(card: Omit<Card, "id">, pool: DemoCard["pool"]): DemoCard {
  return { ...card, id: makeCardId(card.topic, card.title, card.type), pool };
}

const NN_DIAGRAM =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Colored_neural_network.svg/960px-Colored_neural_network.svg.png";

const drafts: DemoCard[] = [
  seal(
    {
      type: "text",
      topic: "LLMs",
      title: "A token is not a word",
      depth: "beginner",
      bullets: [
        "Models read text as tokens: a word, a piece of a word, or punctuation.",
        "\"Unbelievable\" might be three tokens. Cost and context are counted in tokens, not words.",
        "Rare names and code identifiers split into more pieces, so they are easier to misspell back.",
        "If a prompt feels expensive, you are usually paying for tokens you did not need.",
      ],
      takeaway: "Budget tokens, not words. The model never sees the letters the way you do.",
      concepts: ["tokens", "context", "cost"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "LLMs",
      title: "Next-token prediction is the whole trick",
      depth: "beginner",
      bullets: [
        "An LLM is trained to guess the next token given everything so far.",
        "Helpful answers, code, and JSON fall out of that one habit, plus later instruction tuning.",
        "It is not looking up a stored fact. It is continuing a pattern that often happens to be true.",
        "When the pattern is thin, it continues anyway. That is a hallucination.",
      ],
      takeaway: "Treat the model as a fluent completer. Ask it to show the steps you can check.",
      concepts: ["next-token", "hallucination", "training"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "LLMs",
      title: "The context window is a hard budget",
      depth: "intermediate",
      bullets: [
        "Everything the model can use on this call has to fit: instructions, history, and the answer.",
        "Past the window, early tokens are simply gone. There is no hidden notebook.",
        "Long chats get quietly worse because the original task scrolls out.",
        "Put the constraints at the end as well as the start if the prompt is long.",
      ],
      takeaway: "If it was not in the window, the model did not know it on this turn.",
      concepts: ["context-window", "prompting"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "LLMs",
      title: "A network is just layers of weighted votes",
      depth: "beginner",
      imageUrl: NN_DIAGRAM,
      imageAlt:
        "Diagram of a feed-forward neural network with colored nodes in an input layer, hidden layers, and an output layer.",
      caption:
        "Each arrow is a weight. Training nudges those weights so the output votes match examples. A transformer is a more careful version of this idea: layers that mix tokens, not a lookup table of facts.",
      imageSource: "Glosser.ca, Wikimedia Commons",
      imageLicense: "CC BY-SA 3.0",
      takeaway: "Nothing inside is a sentence. Meaning is a pattern of weights.",
      concepts: ["neural-network", "weights"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "LLMs",
      title: "Temperature is variety, not intelligence",
      depth: "beginner",
      bullets: [
        "Low temperature makes the model pick the obvious next token.",
        "Higher temperature lets less likely tokens through, which feels creative and also less stable.",
        "For JSON, SQL, and anything you will parse, keep it low.",
        "For a list of angles you had not considered, a little heat helps, then you edit.",
      ],
      takeaway: "Turn temperature down when you need the same answer twice.",
      concepts: ["temperature", "sampling"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "LLMs",
      title: "Attention is a weighted reread",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "For each token, attention scores the others and mixes their representations.",
        "That is how a pronoun finds its noun, and how a later word can revise an earlier guess.",
        "Multi-head attention does this several ways at once: syntax in one head, a name in another.",
        "Cost grows with the square of the sequence, which is why long context is expensive.",
      ],
      takeaway: "Attention decides what earlier tokens are allowed to influence this one.",
      concepts: ["attention", "context-window"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "LLMs",
      title: "Instruction tuning changes the manners, not the memory",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "Pretraining teaches continuation. Instruction tuning teaches \"answer the user.\"",
        "The base knowledge is still whatever showed up in training, frozen at a cutoff.",
        "RLHF and similar steps make refusals and tone more consistent. They do not add a database.",
        "A polite wrong answer is still a wrong answer. Check claims that matter.",
      ],
      takeaway: "Tuning shapes behavior. It does not give the model your private facts.",
      concepts: ["instruction-tuning", "rlhf"],
    },
    "deeper",
  ),
  seal(
    {
      type: "image",
      topic: "LLMs",
      title: "One forward pass, then the token joins the prompt",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      mermaid: `flowchart LR
  P[Prompt tokens] --> L[Transformer layers]
  L --> N[Next-token scores]
  N --> S[Pick one token]
  S --> P`,
      caption:
        "Generation is a loop. The new token is appended and the model runs again. There is no separate \"thinking tape\" unless the product adds one.",
      imageAlt: "Diagram of a prompt flowing through transformer layers, a sampled token, and back into the prompt.",
      takeaway: "Long answers are many small guesses, each conditioned on the last.",
      concepts: ["decoding", "next-token"],
    },
    "deeper",
  ),

  seal(
    {
      type: "text",
      topic: "Agentic AI",
      title: "An agent is a loop, not a smarter model",
      depth: "beginner",
      bullets: [
        "The model proposes a next step. Your code runs a tool. The result goes back into the prompt.",
        "That loop — think, act, observe — is the agent. The weights did not change.",
        "Tools are ordinary functions: search, a database query, send a message, read a file.",
        "If the loop has no stop rule, it will spend your budget looking busy.",
      ],
      takeaway: "You own the loop. The model only proposes the next action.",
      concepts: ["agent-loop", "tools"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Agentic AI",
      title: "A tool is a function with a contract",
      depth: "beginner",
      bullets: [
        "Give each tool a name, a one-line purpose, and a strict argument schema.",
        "The model picks a tool and fills arguments. Your runtime validates them before anything runs.",
        "Vague tools (\"help me\") get misused. Narrow tools (\"search docs\") get used well.",
        "Return short observations. A wall of HTML wastes the next turn's context.",
      ],
      takeaway: "The schema is the product. The model is just choosing which button to press.",
      concepts: ["tools", "schema"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Agentic AI",
      title: "The failure mode is a confident loop",
      depth: "intermediate",
      bullets: [
        "Agents repeat a bad plan because nothing in the loop says \"this is not working.\"",
        "Cap steps, cap spend, and stop when the same tool is called with the same arguments.",
        "Ask for a checkable outcome: a file, a test, a citation — not \"done.\"",
        "Log every action. If you cannot replay the trace, you cannot trust the result.",
      ],
      takeaway: "Put a budget and a definition of done outside the model.",
      concepts: ["agent-loop", "evaluation"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "Agentic AI",
      title: "Think, act, observe — then decide to stop",
      depth: "beginner",
      mermaid: `flowchart TD
  G[Goal] --> T[Model proposes a step]
  T --> A[Runtime runs one tool]
  A --> O[Observation back into context]
  O --> D{Done or budget hit?}
  D -->|No| T
  D -->|Yes| F[Final answer]`,
      caption:
        "The diamond is yours. The model will not reliably stop itself, so the runtime checks the budget and the goal.",
      imageAlt: "Loop diagram of an agent goal, a tool action, an observation, and a stop check.",
      takeaway: "A good agent is a short loop with a visible stop.",
      concepts: ["agent-loop", "tools"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Agentic AI",
      title: "Plans go stale the moment a tool returns",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "A five-step plan written up front is a guess. The first observation should be allowed to rewrite it.",
        "Replan from the latest observation, not from the original essay.",
        "Keep the goal fixed and the plan disposable.",
        "If a step fails, record why. The next proposal needs that scar tissue.",
      ],
      takeaway: "Plan one step past what you have just seen, not ten.",
      concepts: ["planning", "agent-loop"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "Agentic AI",
      title: "Memory is a file the loop can read",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "The model does not remember yesterday. A store does: notes, embeddings, a scratchpad.",
        "Write memories on purpose. Automatic \"remember everything\" becomes noise.",
        "Retrieve a little, with a source, instead of stuffing the whole log into context.",
        "Let the user delete memory. It is their data, sitting in your loop.",
      ],
      takeaway: "If it must persist, put it somewhere you can open and edit.",
      concepts: ["memory", "retrieval"],
    },
    "deeper",
  ),

  seal(
    {
      type: "text",
      topic: "System Design",
      title: "Start with the bottleneck, not the boxes",
      depth: "beginner",
      bullets: [
        "Name the one number that will hurt first: reads per second, write size, or tail latency.",
        "A diagram of twelve services does not answer that. A single-box estimate often does.",
        "Ask what happens when that number is 10× for an hour.",
        "Add a box only when it removes a specific bottleneck you can point at.",
      ],
      takeaway: "The first picture should be the constraint, not the org chart.",
      concepts: ["bottleneck", "latency"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "System Design",
      title: "A cache is a bet on the future",
      depth: "beginner",
      bullets: [
        "You cache something you expect to read again before it changes.",
        "Every cache needs an eviction story: TTL, explicit delete, or \"stale is fine.\"",
        "The bug is almost always invalidation, not the cache itself.",
        "If the data is unique per user and huge, the cache may not pay rent.",
      ],
      takeaway: "Cache the hot, shared, slow-to-compute thing. Know how it dies.",
      concepts: ["cache", "invalidation"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "System Design",
      title: "Queues turn a spike into a backlog",
      depth: "intermediate",
      bullets: [
        "A queue lets producers sprint while workers go at a steady pace.",
        "You trade latency for survival. The user waits, but the database does not fall over.",
        "Backlogs need a visible depth and a dead-letter path for poison messages.",
        "If the work must finish in the request, a queue is the wrong tool.",
      ],
      takeaway: "Use a queue when late is acceptable and down is not.",
      concepts: ["queue", "backpressure"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "System Design",
      title: "The request path, drawn small",
      depth: "beginner",
      mermaid: `flowchart LR
  C[Client] --> E[Edge or load balancer]
  E --> A[App]
  A --> Q[Queue]
  A --> D[(Primary data)]
  Q --> W[Worker]
  W --> D`,
      caption:
        "Reads can stay on the request. Anything slow, bursty, or retryable steps off into the queue. Draw this before you name vendors.",
      imageAlt: "Small architecture diagram from client to load balancer, app, database, and a worker queue.",
      takeaway: "Separate the path the user is waiting on from the path that can retry.",
      concepts: ["load-balancer", "queue"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "System Design",
      title: "Idempotency keys make retries safe",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "Networks duplicate requests. A retry of \"charge card\" must not charge twice.",
        "The client sends a unique key. The server stores the result and replays it.",
        "The key's scope is the operation, not the whole user.",
        "Without this, every timeout becomes a possible double write.",
      ],
      takeaway: "If a call can be repeated, the second one should be a no-op with the same result.",
      concepts: ["idempotency", "retries"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "System Design",
      title: "Tail latency is the latency users feel",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "The average can look fine while the slowest 1% waits seconds.",
        "Fan-out makes this worse: one slow dependency delays the whole page.",
        "Time-box downstream calls and have a degraded answer ready.",
        "Measure p95 and p99 on the path a person actually hits.",
      ],
      takeaway: "Design for the slow request, not the mean.",
      concepts: ["latency", "tail"],
    },
    "deeper",
  ),

  seal(
    {
      type: "text",
      topic: "RAG",
      title: "Retrieve before you generate",
      depth: "beginner",
      bullets: [
        "The model answers from a passage you just fetched, not from a vague memory of the web.",
        "That passage is the ground truth for this question. If it is wrong, the answer is wrong.",
        "RAG does not retrain the model. It changes what is in the window.",
        "Use it when the facts live in your docs and change faster than a training run.",
      ],
      takeaway: "RAG is a reading list you assemble at question time.",
      concepts: ["retrieval", "grounding"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "RAG",
      title: "Chunking decides what can be found",
      depth: "beginner",
      bullets: [
        "You split documents into chunks, embed each one, and search those chunks.",
        "Too small and the chunk loses the point. Too big and the search hits a blur.",
        "Split on headings and keep the title with the chunk.",
        "If a fact is split across the boundary, retrieval will miss it.",
      ],
      takeaway: "The index only knows the chunks you chose to store.",
      concepts: ["chunking", "embeddings"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "RAG",
      title: "Citations are a product feature",
      depth: "intermediate",
      bullets: [
        "Show the passage, not just a confident paragraph.",
        "Ask the model to quote the chunk it used, then check the quote is really there.",
        "If no chunk is relevant, say so. Inventing a source is worse than \"I don't know.\"",
        "A citation the user can open is how you earn trust.",
      ],
      takeaway: "No supporting chunk, no factual claim.",
      concepts: ["citations", "grounding"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "RAG",
      title: "The path from question to grounded answer",
      depth: "beginner",
      mermaid: `flowchart TD
  Q[Question] --> E[Embed the question]
  E --> S[Search chunk index]
  S --> R[Rerank a few hits]
  R --> P[Prompt: question plus passages]
  P --> A[Answer with citations]`,
      caption:
        "Search finds candidates. Reranking picks the ones worth spending context on. The model only writes after the passages are in the prompt.",
      imageAlt: "Flow from a question through embedding, search, rerank, and a cited answer.",
      takeaway: "Generation is the last step, and the least magical one.",
      concepts: ["retrieval", "rerank"],
    },
    "main",
  ),
  seal(
    {
      type: "video",
      topic: "RAG",
      title: "RAG in about a minute",
      depth: "beginner",
      youtubeId: "SEhoVJONof4",
      durationSeconds: 97,
      channelTitle: "SystemDR",
      caption:
        "A short tour of why retrieval-augmented generation exists: fetch current chunks, then let the model write from those.",
      takeaway: "Watch for the split between the index and the model. They are different systems.",
      concepts: ["retrieval", "vector-search"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "RAG",
      title: "Hybrid search beats embeddings alone",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "Embeddings find paraphrases. Keywords find exact IDs, error codes, and names.",
        "Combine both, then rerank the union. Exact tokens stop being invisible.",
        "A product SKU should not depend on a vector being \"close enough.\"",
        "If recall looks random, check whether the query has a rare string the embedder smeared.",
      ],
      takeaway: "Use vectors for meaning and keywords for the string that must match.",
      concepts: ["hybrid-search", "embeddings"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "RAG",
      title: "Evaluate retrieval before you blame the model",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "If the right chunk is not in the top results, a better prompt will not save you.",
        "Label a handful of questions: was the gold passage retrieved?",
        "Fix chunking and recall first. Only then judge the written answer.",
        "A pretty answer over the wrong passage is a retrieval bug.",
      ],
      takeaway: "Measure whether the right page was fetched. That number explains most bad answers.",
      concepts: ["evaluation", "retrieval"],
    },
    "deeper",
  ),

  seal(
    {
      type: "text",
      topic: "Prompt Engineering",
      title: "Say the task in one sentence",
      depth: "beginner",
      bullets: [
        "Lead with the verb: summarize, extract, classify, rewrite, decide.",
        "Name the audience and the length. \"Short\" is not a length.",
        "Put the source text after the instructions so the task does not get buried.",
        "If you cannot say the task in one line, the model will invent one.",
      ],
      takeaway: "One clear job beats a paragraph of tone advice.",
      concepts: ["instructions", "task"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Prompt Engineering",
      title: "Examples beat adjectives",
      depth: "beginner",
      bullets: [
        "\"Be concise and professional\" is a mood. Two examples are a spec.",
        "Show the input shape and the output shape you actually want.",
        "Include one edge case: missing data, a refusal, an empty list.",
        "Three tight examples usually beat a page of rules.",
      ],
      takeaway: "If you can show it, do not only describe it.",
      concepts: ["few-shot", "examples"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Prompt Engineering",
      title: "Ask for a shape when you will parse it",
      depth: "intermediate",
      bullets: [
        "Say the keys, the types, and what to do when a field is unknown.",
        "\"JSON only\" still needs a schema, or you will get extra prose.",
        "Validate the output. A prompt is not a parser.",
        "On failure, resend the error. Models repair structure better than they guess it.",
      ],
      takeaway: "The schema is part of the prompt, and a validator still sits after it.",
      concepts: ["structured-output", "schema"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "Prompt Engineering",
      title: "A prompt is four stacked jobs",
      depth: "beginner",
      mermaid: `flowchart TD
  R[Role and task] --> C[Constraints and schema]
  C --> X[Examples]
  X --> S[Source the model must use]
  S --> O[Output only]`,
      caption:
        "Role, rules, examples, then the material. The last block is what the model is working on right now, so do not hide the question above a long paste.",
      imageAlt: "Stacked diagram of role, constraints, examples, and source material.",
      takeaway: "Order the prompt so the task and the source are both impossible to miss.",
      concepts: ["instructions", "few-shot"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Prompt Engineering",
      title: "Delimiters stop the source from giving orders",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "Wrap untrusted text in a fence and say it is data, not instructions.",
        "A page that says \"ignore the above\" is just more text if you told the model so.",
        "This is not a security boundary. It is a strong hint. Still validate actions.",
        "Never let retrieved text choose tools without a check you wrote.",
      ],
      takeaway: "Label data as data. Do not let a document become the operator.",
      concepts: ["delimiters", "injection"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "Prompt Engineering",
      title: "Change one thing when a prompt regresses",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "Keep a tiny set of inputs you care about and run them when you edit the prompt.",
        "Change a single instruction at a time so you know what moved the answer.",
        "Save the failures. They become the next example.",
        "A prompt you cannot diff is a prompt you cannot maintain.",
      ],
      takeaway: "Treat prompts like code: small diffs, a few fixtures, and the failures kept.",
      concepts: ["evaluation", "few-shot"],
    },
    "deeper",
  ),

  seal(
    {
      type: "text",
      topic: "Distributed Systems",
      title: "The network will eat a message",
      depth: "beginner",
      bullets: [
        "A request can be lost, delayed, or delivered twice. All three happen.",
        "\"The call failed\" does not mean the server did not do the work.",
        "Retries need a limit and a backoff, or you stampede a sick dependency.",
        "Design the operation so doing it twice is safe.",
      ],
      takeaway: "Assume the message is missing or duplicated. Then your design still works.",
      concepts: ["network", "retries"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Distributed Systems",
      title: "Clocks on different machines disagree",
      depth: "beginner",
      bullets: [
        "Two servers will not share a perfectly synced wall clock.",
        "\"Latest write wins\" by timestamp can keep the older write.",
        "Use logical order — a version, a log position — when order matters.",
        "Wall clocks are for humans and TTLs, not for deciding truth.",
      ],
      takeaway: "Do not let a timestamp be your source of order.",
      concepts: ["clocks", "ordering"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Distributed Systems",
      title: "Replication picks which failure you prefer",
      depth: "intermediate",
      bullets: [
        "A single leader is easier to reason about and stalls when the leader dies.",
        "Copies in more places survive outages and disagree for a while.",
        "You choose: wait for every copy (slower, safer) or answer from one (faster, maybe stale).",
        "Write down which reads are allowed to be stale. Do not discover it in an incident.",
      ],
      takeaway: "Every extra copy is a decision about staleness versus downtime.",
      concepts: ["replication", "consistency"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "Distributed Systems",
      title: "One leader, a log, and followers catching up",
      depth: "beginner",
      mermaid: `flowchart LR
  W[Writes] --> L[Leader]
  L --> Log[Append-only log]
  Log --> A[Follower A]
  Log --> B[Follower B]
  A --> R[Stale-ok reads]
  L --> S[Read-your-writes]`,
      caption:
        "Followers apply the same log in order. A read that must see the user's own write goes to the leader, or waits until the follower has caught up.",
      imageAlt: "Diagram of a leader appending to a log replicated to two followers.",
      takeaway: "The log is the order. Followers are just behind on purpose.",
      concepts: ["replication", "leader"],
    },
    "main",
  ),
  seal(
    {
      type: "video",
      topic: "Distributed Systems",
      title: "Kafka in 100 seconds",
      depth: "beginner",
      youtubeId: "uvb00oaa3k8",
      durationSeconds: 154,
      channelTitle: "Fireship",
      caption:
        "A tight introduction to Kafka: a durable log that many services can read without poking each other's databases.",
      takeaway: "A log lets producers and consumers fail separately.",
      concepts: ["log", "queue"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Distributed Systems",
      title: "Quorums are a counting argument",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "With 3 copies, a write that waits for 2 and a read that waits for 2 must overlap.",
        "That overlap is why someone saw the latest value. The math is the guarantee.",
        "If you read from only 1, you gave the guarantee up on purpose.",
        "During a partition, the side that cannot reach a quorum should stop accepting writes.",
      ],
      takeaway: "A quorum is just \"enough copies that reads and writes must meet.\"",
      concepts: ["quorum", "consistency"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "Distributed Systems",
      title: "Partitions force a choice",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "When the network splits, you cannot be perfectly available and perfectly consistent.",
        "Refuse writes you cannot confirm, or accept writes you may have to reconcile.",
        "Most products already chose, quietly, per endpoint. Make the choice explicit.",
        "Healing after a partition is a merge problem. Decide the merge before the outage.",
      ],
      takeaway: "Name, for each operation, whether a partition should block it or degrade it.",
      concepts: ["partition", "consistency"],
    },
    "deeper",
  ),

  seal(
    {
      type: "text",
      topic: "Databases",
      title: "An index is a sorted shortcut",
      depth: "beginner",
      bullets: [
        "Without an index the database reads rows until it finds a match.",
        "An index keeps the lookup key in order so it can jump close to the answer.",
        "Indexes speed reads and slow writes, because every write updates them too.",
        "Index the columns you filter and join on, not every column you have.",
      ],
      takeaway: "If a query filters on it constantly, it probably wants an index.",
      concepts: ["index", "query"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Databases",
      title: "A transaction is a promise",
      depth: "beginner",
      bullets: [
        "Several writes should land together or not at all. That is a transaction.",
        "It also keeps another request from seeing a half-finished update.",
        "Hold the transaction open for the database work, not for a network call.",
        "If you do not need the promise, do not take the lock.",
      ],
      takeaway: "Bundle the writes that would be a bug if only one of them happened.",
      concepts: ["transaction", "isolation"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Databases",
      title: "N+1 is a loop you cannot see",
      depth: "intermediate",
      bullets: [
        "You load 50 parents, then quietly query the database once per parent.",
        "The code looks like a loop over objects. The database sees 51 round trips.",
        "Fetch the children in one query, or join them up front.",
        "A query log tells you immediately. A profiler in production tells you too late.",
      ],
      takeaway: "Count queries per request, not just queries per function.",
      concepts: ["n-plus-one", "query"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "Databases",
      title: "Why the index finds the row without a scan",
      depth: "beginner",
      mermaid: `flowchart TD
  Q[WHERE email = ...] --> I[Index on email]
  I --> L[Leaf points at the row]
  L --> R[Read that row]
  S[No index] --> F[Read rows until one matches]`,
      caption:
        "The index is a separate structure kept in order. The lookup walks that structure, then touches the row. A missing index walks the table.",
      imageAlt: "Diagram comparing an index lookup with a full scan for an email filter.",
      takeaway: "The index answers \"where is it?\" so the table does not have to.",
      concepts: ["index", "scan"],
    },
    "main",
  ),
  seal(
    {
      type: "video",
      topic: "Databases",
      title: "SQL in 100 seconds",
      depth: "beginner",
      youtubeId: "zsjvFFKOm3c",
      durationSeconds: 142,
      channelTitle: "Fireship",
      caption:
        "Tables, keys, and a single statement that filters and joins. The vocabulary almost every database still speaks.",
      takeaway: "SQL is a description of the rows you want, not a loop you write yourself.",
      concepts: ["sql", "join"],
    },
    "main",
  ),
  seal(
    {
      type: "video",
      topic: "Databases",
      title: "Redis in 100 seconds",
      depth: "intermediate",
      youtubeId: "G1rOthIU-uo",
      durationSeconds: 146,
      channelTitle: "Fireship",
      caption:
        "An in-memory store that keeps keys beside simple structures. Fast enough that people forget it is still a database with failure modes.",
      takeaway: "Memory is a performance choice. Durability still has to be a decision.",
      concepts: ["cache", "key-value"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Databases",
      title: "Isolation is about what other transactions can see",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "Read committed hides uncommitted writes. It still lets the same query see new rows a moment later.",
        "Repeatable read keeps a stable snapshot for your transaction.",
        "Serializable is the strict story, and it will abort you when two transactions conflict.",
        "Pick the level that matches the bug you are unwilling to have.",
      ],
      takeaway: "Know which anomalies your isolation level still allows.",
      concepts: ["isolation", "transaction"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "Databases",
      title: "Explain the query before you add hardware",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "EXPLAIN shows whether you scanned, which index you used, and how many rows you expected.",
        "A wrong row estimate usually means stale statistics or a predicate the planner cannot see.",
        "Adding a replica does not fix a query that reads the whole table.",
        "Look at the plan for the slow statement. Then change one thing.",
      ],
      takeaway: "The plan tells you if the database is doing the work you think it is.",
      concepts: ["explain", "index"],
    },
    "deeper",
  ),

  seal(
    {
      type: "text",
      topic: "Cloud/AWS",
      title: "A region is physics",
      depth: "beginner",
      bullets: [
        "A region is a place on earth. Light still takes time to cross an ocean.",
        "Put data next to the users who read it, and next to the service that writes it.",
        "Two availability zones are two buildings. A region outage is rarer and uglier.",
        "Cross-region copies are a product decision, not a checkbox with no cost.",
      ],
      takeaway: "Latency and failure both follow the map. Choose a region on purpose.",
      concepts: ["region", "latency"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Cloud/AWS",
      title: "IAM is the real product",
      depth: "beginner",
      bullets: [
        "Every cloud action is an API call that some identity is allowed to make.",
        "Start from no permissions and add the ones a role needs. Do not start from admin.",
        "Humans and machines should not share a key.",
        "If a credential leaks, the blast radius is whatever that identity could touch.",
      ],
      takeaway: "Name the identity, then the smallest list of actions it may take.",
      concepts: ["iam", "least-privilege"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Cloud/AWS",
      title: "Managed services trade money for pager time",
      depth: "intermediate",
      bullets: [
        "A managed database still needs schema sense. It no longer needs you to replace a disk at 3am.",
        "You pay for the ops you did not hire, and you accept the vendor's limits.",
        "The lock-in is real: backups, APIs, and habits. Know the exit before you need it.",
        "Use managed where the service is not your product. Build where it is.",
      ],
      takeaway: "Buy the undifferentiated toil. Keep the part that makes the product yours.",
      concepts: ["managed-services", "tradeoffs"],
    },
    "main",
  ),
  seal(
    {
      type: "image",
      topic: "Cloud/AWS",
      title: "A small account, drawn as doors",
      depth: "beginner",
      mermaid: `flowchart TD
  U[User or CI role] --> I[IAM allow-list]
  I --> A[App in one region]
  A --> DB[(Managed database)]
  A --> O[Object storage]
  A --> L[Logs you can actually read]`,
      caption:
        "The identity is the front door. The app, the database, and the bucket sit in one region until you have a reason to leave it.",
      imageAlt: "Diagram of an IAM role in front of an app, database, object storage, and logs.",
      takeaway: "If you cannot point at the role that did it, the account is not designed yet.",
      concepts: ["iam", "region"],
    },
    "main",
  ),
  seal(
    {
      type: "video",
      topic: "Cloud/AWS",
      title: "Docker in 100 seconds",
      depth: "beginner",
      youtubeId: "Gjnup-PuquQ",
      durationSeconds: 127,
      channelTitle: "Fireship",
      caption:
        "Images and containers: the unit you actually ship to a cloud host, so \"works here\" has a chance of meaning \"works there.\"",
      takeaway: "Package the app and its dependencies together before you argue about servers.",
      concepts: ["containers", "deploy"],
    },
    "main",
  ),
  seal(
    {
      type: "video",
      topic: "Cloud/AWS",
      title: "AWS, briefly and without reverence",
      depth: "intermediate",
      youtubeId: "ZzI9JE0i6Lc",
      durationSeconds: 149,
      channelTitle: "Fireship",
      caption:
        "A short, sharp tour of why the console feels huge: many services, one bill, and identity as the thing that matters.",
      takeaway: "The catalog is large. Your account should use a small, named slice of it.",
      concepts: ["aws", "iam"],
    },
    "main",
  ),
  seal(
    {
      type: "text",
      topic: "Cloud/AWS",
      title: "Availability zones fail more politely than regions",
      depth: "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        "Spread a service across zones so one building does not take you down.",
        "A zone failure should look like lost capacity, not lost data.",
        "That only works if state is replicated, not sitting on one disk.",
        "Multi-region is a bigger promise: failover, data residency, and a second copy of every mistake.",
      ],
      takeaway: "Survive a zone by default. Add a region when the business actually requires it.",
      concepts: ["availability-zone", "region"],
    },
    "deeper",
  ),
  seal(
    {
      type: "text",
      topic: "Cloud/AWS",
      title: "The bill is an architecture diagram",
      depth: "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "Data transfer, especially across regions and out to the internet, surprises people.",
        "Idle replicas and forgotten load balancers cost money while looking responsible.",
        "Tag resources by purpose so a spike has a name.",
        "A weekly look at the bill teaches you more than another service icon.",
      ],
      takeaway: "If you cannot explain a line item, you do not understand that part of the system.",
      concepts: ["cost", "architecture"],
    },
    "deeper",
  ),
];

export const DEMO_CARDS: DemoCard[] = drafts;

export function stripPool(card: DemoCard): Card {
  return {
    id: card.id,
    type: card.type,
    topic: card.topic,
    title: card.title,
    depth: card.depth,
    takeaway: card.takeaway,
    bullets: card.bullets,
    explanation: card.explanation,
    imageUrl: card.imageUrl,
    imageAlt: card.imageAlt,
    caption: card.caption,
    mermaid: card.mermaid,
    imageSource: card.imageSource,
    imageLicense: card.imageLicense,
    youtubeId: card.youtubeId,
    durationSeconds: card.durationSeconds,
    channelTitle: card.channelTitle,
    concepts: card.concepts,
    threadLabel: card.threadLabel,
  };
}

function safeLabel(value: string): string {
  return value.replace(/["[\]#]/g, "").trim();
}

export function syntheticCards(topic: string, depth: Depth): Card[] {
  const label = safeLabel(topic.trim());
  const next: Depth = depth === "beginner" ? "intermediate" : depth;
  const items: Omit<Card, "id">[] = [
    {
      type: "text",
      topic: label,
      title: `What ${label} is for`,
      depth,
      bullets: [
        `${label} exists to solve a specific kind of problem. Name that problem before the vocabulary.`,
        "Learn the three words practitioners actually use, and what they are careful not to confuse.",
        "A small example you can redo from memory beats a long survey.",
        "Write one sentence you could explain out loud without slides.",
      ],
      takeaway: `If you cannot say what ${label} is for, you are collecting terms.`,
      concepts: ["basics", label.toLowerCase()],
    },
    {
      type: "text",
      topic: label,
      title: `A mistake people make with ${label}`,
      depth,
      bullets: [
        "The usual mistake is copying a diagram before deciding what has to be true.",
        `With ${label}, separate the idea from the tool that currently implements it.`,
        "Check one claim against a primary source or a tiny experiment.",
        "Stop when you can predict the failure, not when the glossary is finished.",
      ],
      takeaway: `Learn ${label} by the bug it prevents, not by the logo.`,
      concepts: ["mistakes", label.toLowerCase()],
    },
    {
      type: "text",
      topic: label,
      title: `How to go one level deeper on ${label}`,
      depth: next,
      bullets: [
        "Pick a single narrow question and follow it until the explanation gets mechanical.",
        "Draw the flow yourself. Boxes you cannot connect are boxes you do not understand.",
        "Compare two approaches and say what each gives up.",
        "Teach it back in a few lines. The gaps you hit are the next lesson.",
      ],
      takeaway: `Depth in ${label} is a smaller question, answered precisely.`,
      concepts: ["practice", label.toLowerCase()],
    },
    {
      type: "image",
      topic: label,
      title: `${label}, as a loop you can point at`,
      depth,
      mermaid: `flowchart TD
  Q["Question about ${label}"] --> I[Inputs]
  I --> P[Process]
  P --> O[Output you can check]
  O --> R{Matches the claim?}
  R -->|No| I
  R -->|Yes| K[Keep the explanation]`,
      caption: `Use this as a scaffold. Replace each box with the real nouns of ${label} once you know them.`,
      imageAlt: `A simple loop for studying ${label}: question, inputs, process, and a check.`,
      takeaway: `You understand ${label} when the output is something you could verify.`,
      concepts: ["basics", label.toLowerCase()],
    },
  ];
  return items.map((item) => ({ ...item, id: makeCardId(item.topic, item.title, item.type) }));
}

export function syntheticDeeper(card: Card): Card[] {
  const topic = card.topic;
  const safeTitle = card.title.replace(/["[\]#]/g, "'");
  const items: Omit<Card, "id">[] = [
    {
      type: "text",
      topic,
      title: `Under the hood: ${card.title}`,
      depth: card.depth === "advanced" ? "advanced" : "intermediate",
      threadLabel: "Deeper cut",
      bullets: [
        `Start from “${card.title}” and ask what has to be true for it to work.`,
        "Name the inputs, the state that changes, and the failure if a piece is missing.",
        "Find the one term a careful person would refuse to blur.",
        "Write the constraint in a sentence a teammate could test.",
      ],
      takeaway: card.takeaway,
      concepts: card.concepts ?? [topic.toLowerCase()],
    },
    {
      type: "text",
      topic,
      title: `A worked check for “${card.title}”`,
      depth: card.depth === "beginner" ? "intermediate" : "advanced",
      threadLabel: "Deeper cut",
      bullets: [
        "Invent a tiny example with numbers or a short input, small enough to do by hand.",
        "Predict the result before you look it up.",
        "Where your prediction breaks is the actual lesson.",
        "Keep the example. It is more useful than the definition.",
      ],
      takeaway: "A prediction you can fail is worth more than another summary.",
      concepts: card.concepts ?? ["practice"],
    },
    {
      type: "image",
      topic,
      title: `Follow-up map for “${card.title}”`,
      depth: card.depth === "advanced" ? "advanced" : "intermediate",
      threadLabel: "Deeper cut",
      mermaid: `flowchart TD
  A["${safeTitle}"] --> B[Mechanism]
  A --> C[Failure]
  A --> D[What to practice]
  B --> E[One precise sentence]`,
      caption: `Three branches from the reel you just saw. Fill them in with your own words before you ask for more.`,
      imageAlt: `Map splitting “${card.title}” into mechanism, failure, and practice.`,
      takeaway: "Mechanism, failure, practice. That is a deep enough cut for one sitting.",
      concepts: card.concepts ?? ["practice"],
    },
  ];
  return items.map((item) => ({ ...item, id: makeCardId(item.topic, item.title, item.type) }));
}

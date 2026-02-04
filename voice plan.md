We're going to add our text & voice ai agent.

We're going to use langgraph with openai's web socket vased realtime voice api for voice

and gpt-5-mini for text.

Even though these are 2 interfaces, we want to make as much reusable code as possible.

langgraph reference - /Users/roopesh/Projects/Me/twin/backend/src/langgraph/langgraph.service.ts

So there should be a chat box like chat gpt, with send button and voice button for voice.

There will be new modules, chat and messages, langgraph and any other u find suitable

Now things I want common for voice and text.

1. Create a ws connection which gets booking id, again should verify access here and then retrieve most recent chat with this booking id

2. Get the booking details with hotel details for ctxt

Make a chat context service which is like almost identical to this /Users/roopesh/Projects/Me/twin/backend/src/chat-context/chat-context.service.ts

You would use buildChatContext to get the chat context to give to llm

3. We're going to give tools which are create, update, appendusermessage, appendstaffmessage, findByIdForAccount(booking service)

Make these as tools and pass like booking id and account (extracted from token when ws established) and any other stuff to all the tools so they can use account which is needed in all functions, so the llm would only need to pass limited innfo and no info about account

let accountId be mandatory
instead of in memory cache , use cache.service in this repo

voice is also handled in same ws, nothing client side.

we will implement both voice and text simultaneously

Request vs chat -> one booking can have multiple chats, and in chat the user can create multiple requests, in requests store the chatId as well

Make proper tasks to do this step by step

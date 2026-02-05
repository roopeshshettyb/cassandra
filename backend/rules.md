1. All strings should be in constants service and read from env wherever it's a secret
2. Every API needs to be secure. So ownership should be verified.

Example ->

Update Hotel API

In the where condition the accountId would be passed by default when called by api, only exception to this is if the account type is admin

3. Update seed.ts with proper seeding for every model with ample amount of data

4. Run build and ensure no issues.

5. standard response structure for api is {success,message,data}

6. Avoid map , forEach, at all costs. Only use good old for loops ONLY IF ABSOLUTELY NECESSARY.

# Mini One

I created a "mini" _One_ application, replicating some of the main features at a very basic level, using Node.js. The application was developed keeping scalability in mind, such as dynamically loading all routes files as well as schema models to avoid circular dependencies. A user can make an account, create a debit card, and then start performing transactions. These can be credits to their account to build up a balance, and then withdrawal purchases from venders. There are cashback payments for eligible purchases, as well as interest payments for maintaining a positive balance.

To interact with this application, I created a [Postman collection](https://documenter.getpostman.com/view/9397937/2sAXqm9jZB) that performs some CRUD operations on the `User`, `DebitCard`, and `Transaction` models.

## Features and Functionality
Some of the main features include the following:
- Creating, finding, and updating a `User` account
- Creating a `DebitCard`, marking it as active or inactive, finding associated transactions, and getting the balance
- Creating `Transaction` objects to credit a debit card or make a purchase with current funds
- Transactions are created in a pending state and are moved to completed or failed based on the account balance via a cron job
- Transactions can be canceled if done so while still in the pending state
- Eligible purchases from venders `WLMRT`, `AMZN` and `APPL` create cashback transactions
- Debit card accounts with positive balances are paid out interest via a cron job
- Debit card accounts that are pushed into a negative balance are charged an overdraft fee
- Transfer payments can be made between debit card accounts

## Future Improvements
Due to time constraints I was not able to create an application with the ideal full functionality, there are limitations in teh quantity and quality of features I was able to produce. However, if given more time these are the improvements I would make to create a more complete and functional application -
- Features
   - **User interface** - while the Postman collection allows you to interact with the application, it would be great to have a UI with a user login, dashboard, etc. to get the full experience in creating debit card transactions and transfers
   - **Debit Card Expansion** - currently a user is only able to have one debit card for ease of operation, but they should be able to open multiple cards replicating more similar to a checking and savings account
   - **Transaction Currencies** - a user should be able to create transactions in various currencies and handle the conversions, rather than the current state that assumes all transactions are USD
   - **Notifications** - with the behind-the-scenes operations happening - such as cashback transactions on eligible purchases, interest payment transactions on positive balances, overdraft fees for negative balances, etc. - there should be a notification mechanism that alerts the user of these events
- Security
   - **Permissions** - there are currently no permissions blocking information from a given user, but there should be an authentication process to be able to only see information and objects related to the authenticated user
   - **Personal Information** - as this is a personal application, I did not implement any security/encryption on PII or a debit card account number for example that would be necessary for this application
- Resilience
   - **Retry Logic** - there are certain operations that occur that aren't completely fault tolerant and could benefit from a retry system to ensure there are no terminal failures that should have been successful
   - **Integration Tests** - while the unit tests can successfully test the flow of operations, having integration tests would ensure that all aggregation queries and other important database operations are in face working as expected
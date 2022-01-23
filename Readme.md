![how-it-works](https://github.com/iblessedi/nodejs-task/blob/master/public/images/result.png?raw=true)

#Requirements for this task:

In this task you need to write the REST API in Node.js with next endpoints:
1) GET /customers/:id - should return a JSON of a specific customer, that is returned from predefined hardcoded array of customers, no DB is needed, 404 if the customer does not exist with this id
2) GET /products/:id - should return a JSON of product, that is returned from the predefined hardcoded array of products, no DB is needed, 404 if does not exist
3) GET /multiple/?bob=/customers/13&alice=/customers/25&ketchup=/products/993&mustard=/products/90&.....<uniqueRandomId=<randomURI>>
   That should return response in the next format: object with keys
   {
   “bob”: {“data”: {“name”: “Bob”, id: “13”, age: “27”}},
   “alice”: {“data”: {“name”: “Alice”, id: “25”, age: “18”}},
   “ketchup”: {“data”: {“name”: “Heinz”, id: “993”, price: “221.00”}},
   “mustard”: {“error”: {“status”: 404, response: {“message”: “product does not exist”}} },
   …
   <uniqueRandomId>: {
   If response was successful (status 200)
   {“data”: <response from original endpoint>}
   In case if status was not 200
   {“error”: {“status”: <original status code>, response: <original response>}}
   }
   }


Try to use as little memory as possible
Stream data to the response as soon as possible
Think about error handling
Make sure, that this solution will work for 5gb+ sub responses.
Cover this endpoint with tests for both success and non-success scenarios
Try to simulate with tests the worst-case scenarios like the server didn’t respond to some of the sub-endpoints
/multiple endpoint should do http requests to subendpoints as to external service.


Tips: Try to build a working solution first and optimize it later, if possible. Non Optimal solution is better than not working solution. Feel free to use any technologies you want, preferably pure JS and Express, but this is not a requirement. 


#To run the app do:
- npn run start

#To run the tests do:
- npm run test

## Purchase
  `Purchase` Endpoint for managaing purchases.

### Endpoint Summary
* `[GET]` /api/purchases - [Retrieve All *Purchases*](#Retrieve-All-Purchases)
* `[POST]` /api/purchase - [Create a new *Purchase*](#Create-a-new-Purchase)
* `[GET]` /api/purchase/<.id> - [Retrieve a single *Purchase* with `id`](#Retrieve-a-single-Purchase)
* `[PUT]` /api/purchase/<.id> - [Edit a single *Purchase* with `id`](#Edit-a-single-Purchase)
* `[DELETE]` /api/purchase/<.id> - [Delete a single *Purchase* with `id`](#Delete-a-single-Purchase)
* `[GET]` /api/purchases/test - [Quick Test purchase](#Quick-Test-purchase)
* `[DELETE]` /api/purchases - [Delete all *purchases* in the collection](#Delete-all-purchases)
* `[SEARCH]` /api/purchases/search - [Searches all *purchases* for multiple values](#Search-purchases)


**N.B**: The `/test` endpoint of this purchase is for quick development testing only. Do Disable this when in production!


### Retrieve All Purchases

* **Syntax** : `[GET] /api/purchases [?skip= X & limit= Y]` 
* **URL** :  `/api/purchases`  
* **Method**: `GET`  
* **URL Params**:   
   **Required:**   None  
   **Optional:**
 
   `skip=[Integer]` - Offsets(Skips) index of results  
   `limit=[Integer]` - Total number of results in the current request to return
* **Success Response:**
 
   **Code:** 200 <br />
    **Content:** 
    ```
    {
      "status": "success",
      "data": {
        "purchases": [
          {
            "_id": "587100001657a2bd9c5a00df",
            status : String,
			 user : String,
			 type : String,
			 info : String,
			 provider : String,
			 method : String,
			 receiptid : String,
            "__v": 0
          },
          .
          .
          .
        ],
        "count": 1
      },
      "message": null
    }
    ```

* **Sample Call:**

   `  curl "http://localhost:3000/api/purchases"`  
 Fetches 5 purchase results skipping the first 2  

* **Notes:**

 
### Create a new Purchase 

* **Syntax** : `[POST] /api/purchase`
* **URL** :  `/api/purchase`  
* **Method**: `POST`  
* **URL Params**:   
   **Optional:**   None  
   **Required:**  
 
   `{purchase:{}}` - The base purchase data object  
   ```
    { 
      "purchase" : {
        status : String, 
        user : String, 
        type : String, 
        info : String, 
        provider : String, 
        method : String, 
        receiptid : String
         
      }
    }
   ```
* **Success Response:**
 
   **Code:** 201  
   **Content:** 
    ```
      {
        "status": "success",
        "data": {
          "__v": 0,
          "_id": "58713aaf1657a2bd9c5a00e0",
          status : String, 
          user : String, 
          type : String, 
          info : String, 
          provider : String, 
          method : String, 
          receiptid : String
           
        },
        "message": null
      }
    ```
* **Error Response:**
 
   **Code:** 500 <br />
    **Content:** 
    ```
      {
        "status": "error",
        "data": "Invalid purchase/key model provided",
        "message": "There was an error saving this data."
      }
    ```
* **Sample Call:**

  ``` 
      curl -X POST -H "Content-Type: application/json" 
        -H "Cache-Control: no-cache" -d     '{
        "purchase":{
            "name":"pen",
            "price":2.54
            }
        }' "http://localhost:3000/api/purchase"
    
    ```
  The key model being `purchase` the saves a 'pen' data 

* **Notes:**




### Retrieve a single Purchase 

* **Syntax** : `[GET] /api/purchase/:id`
* **URL** :  `/api/purchase/:id`  
* **Method**: `GET`  
* **URL Params**:   
   **Optional:**   None  
   **Required:**  
 
   `id` - The object id of the purchase  
   
* **Success Response:**
 
   **Code:** 200  
   **Content:** 
    ```
      {
        "status": "success",
        "data": {
          "_id": "587100001657a2bd9c5a00df",
          "__v": 0,
          status : String, 
          user : String, 
          type : String, 
          info : String, 
          provider : String, 
          method : String, 
          receiptid : String
           
        },
        "message": null
      }
    ```
* **Error Response:**
 
   **Code:** 404   
   **Content:** 
    ```
      {
        "status": "error",
        "data": 404,
        "message": "Not Found Error"
      }
    ```
* **Sample Call:**

  ``` 
      curl -X GET -H "Content-Type: application/json" 
        -H "Cache-Control: no-cache" 
        "http://localhost:3000/api/purchase/587100001657a2bd9c5a00d"
    
    ```
  Fetches a single purchase from the collection `purchases`

* **Notes:**




### Edit a single Purchase

* **Syntax** : `[PUT] /api/purchase/:id`
* **URL** :  `/api/purchase/:id`  
* **Method**: `PUT`  
* **URL Params**:   
   **Optional:**   None  
   **Required:**  
 
  `id` - The object id of the purchase  
    `{purchase:{}}` - The base purchase data object that needs to be changed 
   ```
    { 
      "purchase" : {
        status : String, 
        user : String, 
        type : String, 
        info : String, 
        provider : String, 
        method : String, 
        receiptid : String
         
      }
    }
   ```
* **Success Response:**
 
   **Code:** 202  
    **Content:** 
    ```
      {
        "status": "success",
        "data": {
          "_id": "587100001657a2bd9c5a00df",
          "__v": 0,
          status : String, 
          user : String, 
          type : String, 
          info : String, 
          provider : String, 
          method : String, 
          receiptid : String
           
        },
        "message": null
      }
    ```
* **Error Response:**
 
   **Code:** 500  
   **Content:** 
    ```
      {
        "status": "error",
        "data": "Invalid purchase/key model provided",
        "message": "There was an error updating this data."
      }
    ```
    
   **Code:** 404  
   **Content:** 
    ```
    {
      "status": "error",
      "data": 404,
      "message": "No Data Found"
    }
    ```
* **Sample Call:**

  ``` 
      curl -X PUT -H "Content-Type: application/json" 
        -H "Cache-Control: no-cache" 
        -d '{
              "purchase22":{
                  "name":"sharpner",
                  "price":2.55
                }
            }' "http://localhost:3000/api/purchase/587100001657a2bd9c5a00df"
    
    ```
  The key model being `purchase` which updates a 'sharpner' data 

* **Notes:**








### Delete a single Purchase

* **Syntax** : `[DELETE] /api/purchase/:id`
* **URL** :  `/api/purchase/:id`  
* **Method**: `DELETE`  
* **URL Params**:   
   **Optional:**   None  
   **Required:**  
 
  `id` - The object id of the purchase  
* **Success Response:**
 
   **Code:** 202  
    **Content:** 
    ```
    {
      "status": "success",
      "data": "The purchase got Deleted",
      "message": null
    }
    ```
* **Error Response:**
 
   **Code:** 500  
   **Content:** 
    ```
      {
      "status": "error",
      "data": "Error in deleting this purchase",
      "message": {
        .
        .
        .
      }
    }
    ```
    
* **Sample Call:**

  ``` 
    curl -X DELETE "http://localhost:3000/api/purchase/58713b0a1657a2bd9c5ad"
    ```
  The key model being `purchase` which updates a 'sharpner' data 

* **Notes:**





### Delete all Purchases

* **Syntax** : `[DELETE] /api/purchases`
* **URL** :  `/api/purchases`  
* **Method**: `DELETE`  
* **URL Params**:   
   **Optional:**   None  
   **Required:**  None 
* **Success Response:**
 
   **Code:** 202  
   **Content:** 
   ```
    {
      "status": "success",
      "data": "All purchases got Delete",
      "message": null
    }
   ```
* **Error Response:**
 
   **Code:** 500  
   **Content:** 
   ```
      {
        "status": "error",
        "data": "Error in deleting all purchases",
        "message": {
          .
          .
          .
        }
      }
    ```
    
* **Sample Call:**

  ``` 
    curl -X DELETE "http://localhost:3000/api/purchases"
    ```
  The key model being `purchase` which updates a 'sharpner' data 

* **Notes:**




### Search Purchases

* **Syntax** : `[GET] /api/purchases/search [?skip= X & limit= Y & keyword= field:value [,field:value]]` 
* **URL** :  `/api/purchases/search`  
* **Method**: `GET`  
* **URL Params**:   
   **Required:**   keyword  
   **Optional:**
 
   `skip=[Integer]` - Offsets(Skips) index of results  
   `limit=[Integer]` - Total number of results in the current request to return
   `keyword=[CSV]` - keyword = field1:value1, filed2:value2 ... 
    `strict=[Boolean]` - Performs Strict search.

* **Success Response:**
 
   **Code:** 200 <br />
    **Content:** 
    ```
    {
      "status": "success",
      "data": {
        "purchases": [
          {
            "_id": "587100001657a2bd9c5a00df",
            name : String,
        price : Number,
            "__v": 0
          },
          .
          .
          .
        ],
        "count": 1
      },
      "message": null
    }
    ```

* **Sample Call:**

   `  curl "http://localhost:3000/api/purchases/search?keyword=first:Sam,last:Jones"`  
 Searches purchases with rows with its first name 'Sam' and last name 'Jones'

* **Notes:**
To use Strict Search, add param ?strict=true
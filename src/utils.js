// @flow

export default class Utils {
  static executeAllPromises = (promises: Array<any>) => {
    // Wrap all Promises in a Promise that will always "resolve"
    var resolvingPromises = promises.map((promise) => {
      return new Promise((resolve) => {
        var payload = new Array(2)
        promise
          .then((result) => {
            payload[0] = result
          })
          .catch((error) => {
            payload[1] = error
          })
          .then(() => {
            /* 
            * The wrapped Promise returns an array:
            * The first position in the array holds the result (if any)
            * The second position in the array holds the error (if any)
            */
            resolve(payload)
          })
      })
    })

    let errors: Array<string> = []
    var results: Array<any> = []

    // Execute all wrapped Promises
    return Promise.all(resolvingPromises).then(function(items) {
      items.forEach(function(payload) {
        if (payload[1]) {
          errors.push(payload[1])
        } else {
          results.push(payload[0])
        }
      })

      return {
        errors: errors,
        results: results
      }
    })
  }

  static count = (array: Array<any>, value: any) => {
    return array.filter((v) => v === value).length
  }
}

// throttledFetch.js
export default class ThrottledFetch {
  constructor(maxParallelRequests = 10, name="ThrottledFetch") {
    this.maxParallelRequests = maxParallelRequests;
    this.activeRequests = 0;
    this.queue = [];
    this.name = name;
    // setInterval(() => 
    //     console.log(this.name, this.activeRequests, this.queue.length)
    // , 5000);

  }

  throttledFetch(url, options) {
    return new Promise((resolve, reject) => {
      const task = () => {
        this.activeRequests++;

        fetch(url, options)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.activeRequests--;
            this.processQueue(); // Process next request in queue if available
          });
      };

      if (this.activeRequests < this.maxParallelRequests) {
        task();
      } else {
        this.queue.push(task); // Queue the task if limit is reached
      }
    });
  }

  processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.maxParallelRequests) {
      const nextTask = this.queue.shift();
      nextTask();
    }
  }
}

/**
 * @module processTriggerManager - Ensure all process triggers get registered in
 * process_manager * exactly once. The CircuitBreaker prevents process_manager
 * from being overwhelmed with failing requests. The Queue is a fallback to save
 * failed requests and handle retries, if process manager is unavailable.
 */
const { v4: uuid } = require("uuid");
const CircuitBreaker = require("opossum");
const ProcessTriggerQueue = require("./queue.js");
const getTenants = require("../../queries/getTenants.js");

const processTriggerQueueCache = {};
/**
 * @const {object} processTriggerQueueCache - We only want one
 * ProcessTriggerQueue instance per tenant
 * @example { tenant: ProcessTriggerQueue }
 */

let pmTriggerCircuitBreaker;
/**
 * @const {CircuitBreaker} pmTriggerCircuitBreaker - this gets set by
 * initCircuitBreaker()
 */

/**
 * @function initProcessTriggerQueues
 * @description reads our tentant list from DB then make sure each gets a
 * ProcessTriggerQueue instance. This gets called after startup.
 * @param {ABRequestService} req
 */
async function initProcessTriggerQueues(req) {
   initCircuitBreaker();
   const tenants = (await getTenants(req)) ?? [];
   const promises = [];
   tenants.forEach((tenant) => {
      promises.push(getProcessTriggerQueue(tenant.uuid, req));
   });
   await Promise.all(promises);
}

/**
 * @function initCircuitBreaker
 * @description Initializes an oppossum circuit breaker, which is used to send
 * service requests to 'process_manager.trigger'. The CircuitBreaker uses a
 * fallback function (saveToQueue), so we can hanlde failures. If the requests
 * are failing repeatedly the breaker flips and uses the fallback directly. This
 * gives process_manager time to recover, before the CircuitBreaker tries again.
 */
function initCircuitBreaker() {
   const options = {
      timeout: 3000, // If request takes longer than 3 seconds, trigger a failure
      errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
      resetTimeout: 30000, // After 30 seconds, try again.
   };
   pmTriggerCircuitBreaker = new CircuitBreaker(
      (req, jobData) =>
         new Promise((resolve, reject) => {
            req.serviceRequest("process_manager.trigger", jobData, (err) => {
               if (err) reject(err);
               else resolve();
            });
         }),
      options
   );
   pmTriggerCircuitBreaker.fallback(saveToQueue);

   // Debug Code
   // let route = "Process Manager";
   // pmTriggerCircuitBreaker.on("success", (result) =>
   //    console.log(`SUCCESS: ${JSON.stringify(result)}`)
   // );
   //
   // pmTriggerCircuitBreaker.on("timeout", () =>
   //    console.log(`TIMEOUT: ${route} is taking too long to respond.`)
   // );
   //
   // pmTriggerCircuitBreaker.on("reject", () =>
   //    console.log(`REJECTED: The breaker for ${route} is open. Failing fast.`)
   // );
   //
   // pmTriggerCircuitBreaker.on("open", () =>
   //    console.log(`OPEN: The breaker for ${route} just opened.`)
   // );
   //
   // pmTriggerCircuitBreaker.on("halfOpen", () =>
   //    console.log(`HALF_OPEN: The breaker for ${route} is half open.`)
   // );
   //
   // pmTriggerCircuitBreaker.on("close", () =>
   //    console.log(`CLOSE: The breaker for ${route} has closed. Service OK.`)
   // );
}

/**
 * @function getProcessTriggerQueue
 * @description get the ProcessTriggerQueue instance for a given tenant. Will
 * create an instance if necessary.
 * @param {string} tenant tenant uuid
 * @return {ProcessTriggerQueue}
 */
async function getProcessTriggerQueue(tenant, req) {
   if (!processTriggerQueueCache[tenant]) {
      processTriggerQueueCache[tenant] = new ProcessTriggerQueue(
         tenant,
         registerProcessTrigger,
         req
      );
      await processTriggerQueueCache[tenant].init();
   }
   return processTriggerQueueCache[tenant];
}

/**
 * @function saveToQueue
 * @description will save the jobData to the relevant tenant's ProcessTriggerQueue
 * This is the fallback function used in the circuit.
 * @param {ABRequestService} req
 * @param {object} jobData for process_manager.trigger
 * @returns {string} "fallback" this helps track our retries since the call to
 * CircuitBreaker.fire resolves even if the fallback was used
 */
async function saveToQueue(req, jobData) {
   try {
      const queue = await getProcessTriggerQueue(req.tenantID());
      await queue.add(req, jobData);
   } catch (err) {
      console.log(err);
      // Adding to the Queue failed too? then notify developers
      // handle this
   }
   return "fallback";
}

/**
 * @function registerProcessTrigger
 * @description preforms a service request to process_manager.trigger using the
 * CircuitBreaker
 * @param {ABRequestService} req
 * @param {object} job data to send with the service request
 * @param {string} job.key triggerKey normally <objectid>.add or .update/.delete
 * @param {object} job.data data to send to the process trigger
 * @param {string} job.requestId unique request id, assigns a new uuid if not provided
 * @returns {Promise} resolves to string "fallback" if the fallback function was used
 */
function registerProcessTrigger(req, { key, data, requestId }) {
   const jobData = {
      key,
      data,
      requestId: requestId ?? uuid(),
   };
   return pmTriggerCircuitBreaker.fire(req, jobData);
}

// Exports are helpers that use the triggerQueue of the correct tenant
module.exports = {
   registerProcessTrigger,
   initProcessTriggerQueues,
};

import init, {
    Provider,
    BackendBehaviour,
    debug,
    rings_node,
    SNARKTaskBuilder,
    SNARKBehaviour,
    SNARKVerifyTaskRef,
    SupportedPrimeField,
    Input,
    SNARKProofTaskRef,
    Circuit
} from '@ringsnetwork/rings-node'

import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { CallBackEventData, EventData } from './WorkerTypes';

let provider: Provider
let account: PrivateKeyAccount
let signer: Function
let snark: SNARKBehaviour

function hexToBytes(hex: number | string) {
  hex = hex.toString(16)
  hex = hex.replace(/^0x/i, '')
  for (var bytes: number[] = [], c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.slice(c, c + 2), 16))
  return bytes
}

const service_message_handler = async (ctxRef: any, providerRef: any, msgCtx: any, msg: any) => {
  console.log('service_message_handler')
  console.log(msg)
}

const plain_text_message_handler = async (ctxRef: any, providerRef: any, msgCtx: any, msg: any) => {
  console.log('plain_text_message_handler')
  console.log(msg)
}

const extension_message_handler = async (ctxRef: any, providerRef: any, msgCtx: any, msg: any) => {
  console.log('extension_message_handler')
  console.log(msg)
}

self.addEventListener('message', async (event) => {
  const data = event.data;
  const result = await performIntensiveTask(data);
  self.postMessage(result);
});

async function performIntensiveTask(data:EventData) {
  if (data.type === 'init') {
    await init()
    // debug(true)
    const returnData:CallBackEventData = {
      type: "init"
    }
    return returnData
  }  else if (data.type === 'config') {
    account = privateKeyToAccount(data.pk!)
    snark = data.snark!
    const returnData:CallBackEventData = {
      type: "config",
      address: account.address
    }
    return returnData
  } else if (data.type === 'new') {
    // debug(true)
    account = privateKeyToAccount(data.pk!)
    signer = async (proof: string): Promise<Uint8Array> => {
      const signed = await account.signMessage({ message: proof })
      return new Uint8Array(hexToBytes(signed!));
    }
    const snark = new SNARKBehaviour()
    const context = new BackendBehaviour(
      service_message_handler,
      plain_text_message_handler,
      extension_message_handler,
      snark.clone()
    )
    provider = await new Provider(
      // ice_servers
      'stun://stun.l.google.com:19302',
      // stable_timeout
      BigInt(1),
      // account
      account.address,
      // account type
      "eip191",
      // signer
      signer,
      // callback
      context
    )
    console.log(provider)
    await provider.listen()
    const returnData:CallBackEventData = {
      type: "new",
      address: account.address
    }
    return returnData
  } else if (data.type === 'createOfferRequest') {
    console.log(provider)
    console.log(account.address)
    const corResponse: rings_node.CreateOfferResponse = await provider.request("createOffer", data.createOfferRequest)
    const returnData:CallBackEventData = {
      type: "createOfferResponse",
      address: account.address,
      createOfferResponse: corResponse
    }
    return returnData
  } else if (data.type === 'answerOfferRequest') {
    const aorResponse: rings_node.AnswerOfferResponse = await provider.request("answerOffer", data.answerOfferRequest)
    const returnData:CallBackEventData = {
      type: "answerOfferResponse",
      address: account.address,
      answerOfferResponse: aorResponse
    }
    return returnData
  } else if (data.type === 'acceptAnswerRequest') {
    const aarResponse: rings_node.AcceptAnswerResponse = await provider.request("acceptAnswer", data.acceptAnswerRequest)
    const returnData:CallBackEventData = {
      type: "acceptAnswerResponse",
      address: account.address,
      acceptAnswerResponse: aarResponse
    }
    return returnData
  } else if (data.type === 'genProofRequest') {
    const circuitsJsonArray = data.genProofCircuits!
    var circuitsArray : Circuit[] = []
    for (let index = 0; index < circuitsJsonArray.length; index++) {
      const circuitsJson = circuitsJsonArray[index];
      console.log('from json START')
      circuitsArray.push(Circuit.from_json(circuitsJson))
      console.log('from json END')
    }
    const task = SNARKBehaviour.gen_proof_task_ref(circuitsArray)
    console.log("gen task DONE")
    console.log("gen proof")
    console.log(task)
    const proof = SNARKBehaviour.handle_snark_proof_task_ref(task.clone())
    console.log("gen proof DONE")
    console.log("verify")
    let ret = SNARKBehaviour.handle_snark_verify_task_ref(proof.clone(), task.clone())
    console.log("verify DONE", ret)

    const returnData:CallBackEventData = {
      type: "genProofResponse",
      address: account.address,
      proof: proof
    }
    return returnData
  }
}

import init, {
    Provider,
    BackendBehaviour,
    debug,
    rings_node,
    SNARKTaskBuilder,
    SNARKBehaviour,
    SupportedPrimeField,
    Input
} from '@ringsnetwork/rings-node'

import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { CallBackEventData, EventData } from './WorkerTypes';

let provider: Provider
let account: PrivateKeyAccount
let signer: Function

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
  if (data.type === 'new') {
    await init()
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
    console.log('123')
    console.log(provider)
    await provider.listen()
    const returnData:CallBackEventData = {
      type: "new",
      address: account.address
    }
    return returnData
  } else if (data.type === 'createOfferRequest') {
    console.log('456')
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
  }
}
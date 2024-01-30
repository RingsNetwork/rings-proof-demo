import { PrivateKeyAccount } from 'viem/accounts'
import { Provider, rings_node, Circuit, SNARKVerifyTaskRef, SNARKBehaviour, SNARKProofTaskRef } from '@ringsnetwork/rings-node'

export interface EventData {
    type: string,
    pk?: `0x${string}`,
    createOfferRequest?: rings_node.CreateOfferRequest,
    answerOfferRequest?: rings_node.AnswerOfferRequest,
    acceptAnswerRequest?: rings_node.AcceptAnswerRequest,
    snark?: SNARKBehaviour,
    genProofCircuits? :string[]
}

export interface CallBackEventData {
    type: string,
    address?: string,
    createOfferResponse?: rings_node.CreateOfferResponse,
    answerOfferResponse?: rings_node.AnswerOfferResponse,
    acceptAnswerResponse?: rings_node.AcceptAnswerResponse,
    proof?: SNARKVerifyTaskRef
}
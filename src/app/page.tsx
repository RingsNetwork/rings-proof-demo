'use client';
import { useEffect, useState } from "react";
import Image from "next/image";
import classNames from 'classnames';
import { DefaultNode, Graph } from '@visx/network';
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
import { PrivateKeyAccount, generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { EventData, CallBackEventData } from "@/components/rings/WorkerTypes";

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

interface RNode {
  x: number,
  y: number,
  pk: string,
  account: PrivateKeyAccount,
  provider: Provider,
  snark: SNARKBehaviour,
  worker: Worker,
}

interface RLink {
  source: RNode;
  target: RNode;
}

export default function Home() {
  const [wasm, setWasm] = useState<any>(null)
  // const [worker, setWorker] = useState<any>(null)
  const [nodes, setNodes] = useState<any>(null)
  const [nodesData, setNodesData] = useState<any>(null)
  useEffect(() => {
    if (!wasm) {
      const initWasm = async () => {
        const w = await init()
        //        debug(true)
        setWasm(w)
      }

      initWasm()
    }
  }, [wasm])

  // useEffect(() => {
  //   if (!worker) {
  //     const w = new Worker(new URL('@/components/rings/rings-node.worker.tsx', import.meta.url))
  //     var initEventData: EventData = {
  //       type: 'init'
  //     }
  //     w.postMessage(initEventData)
  //     setWorker(w)
  //   }
  // }, [worker])

  useEffect(() => {
    if (!wasm) {
      return
    }
    console.log('wasm found')

    const generateNodesOnCircle = async (numberOfNodes: number, radius = 200, centerX = 250, centerY = 250) => {
      let newNodes: RNode[] = [];
      let pks: `0x${string}`[] = []
      for (let i = 0; i < numberOfNodes; i++) {
        const pk = generatePrivateKey()
        pks.push(pk)
      }
      pks.sort((a, b) => {
        const aAddr = privateKeyToAccount(a).address.toLowerCase()
        const bAddr = privateKeyToAccount(b).address.toLowerCase()
        if (aAddr > bAddr) return -1;
        if (aAddr < bAddr) return 1;
        return 0;
      });
      /* pks.reverse() // bad case */
      for (let i = 0; i < numberOfNodes; i++) {
        const angle = 2 * Math.PI * i / numberOfNodes;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        const pk = pks[i]
        const account = privateKeyToAccount(pk)
        const signer = async (proof: string): Promise<Uint8Array> => {
          const signed = await account.signMessage({ message: proof })
          return new Uint8Array(hexToBytes(signed!));
        }

        const listen = async () => {
          const snark = new SNARKBehaviour()
          const context = new BackendBehaviour(
            service_message_handler,
            plain_text_message_handler,
            extension_message_handler,
            snark.clone()
          )
          let provider: Provider = await new Provider(
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
          await provider.listen()
          /* console.log(provider, circuits, account.address, snark_backend, snark_task_builder)
             console.log("start send proof task to self")
             await snark_backend.send_proof_task_to(
             provider,
             circuits,
             account.address
             )
             console.log("end send proof task")
           */
          if (i > 0) {
            const prevItem = newNodes[i - 1];

            const cor = new rings_node.CreateOfferRequest({ did: account.address })
            const corResponse: rings_node.CreateOfferResponse = await prevItem.provider.request("createOffer", cor)

            const aor = new rings_node.AnswerOfferRequest({ offer: corResponse.offer })
            const aorResponse: rings_node.AnswerOfferResponse = await provider.request("answerOffer", aor)

            const aar = new rings_node.AcceptAnswerRequest({ answer: aorResponse.answer })
            await prevItem.provider.request("acceptAnswer", aar)
          }
          const worker = new Worker(new URL('@/components/rings/rings-node.worker.tsx', import.meta.url))
          worker.onmessage  = function (event) {
            const data:CallBackEventData = event.data;
            console.log(data)
          }
          var initEventData: EventData = {
            type: 'init'
          }
          worker.postMessage(initEventData)
          var configEventData: EventData = {
            type: 'config',
            pk: pk
          }
          worker.postMessage(configEventData)
          newNodes.push({ x, y, pk, account, provider, snark, worker});
        }
        await listen()
      }
      setNodes(newNodes)
    }

    generateNodesOnCircle(16);
  }, [wasm]);

  const setupNodes = () => {

  }

  const singleProof = async () => {
    console.log(nodes[0])
    const F = SupportedPrimeField.Pallas
    console.log("loading r1cs and wasm START")
    const snarkTaskBuilder = await new SNARKTaskBuilder(
      "http://localhost:3000/merkle_tree.r1cs",
      "http://localhost:3000/merkle_tree.wasm",
      F
    )
    console.log("loading r1cs and wasm DONE")
    /// Root of merkle tree
    console.log("init input START")
    const publicInputData = [["leaf", [BigInt(42)]]]
    const input = Input.from_array(publicInputData, F)
    /// Path of merkle tree, path[0]: leaf, path[1]: position (left or right)
    const privateInput = [
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
      [["path", [BigInt(123456), BigInt(0)]]],
      [["path", [BigInt(33), BigInt(1)]]],
      [["path", [BigInt(3333), BigInt(0)]]],
      [["path", [BigInt(31), BigInt(1)]]],
      [["path", [BigInt(4), BigInt(1)]]],
      [["path", [BigInt(41123), BigInt(0)]]],
    ].map((input) => Input.from_array(input, F))
    console.log("init input DONE")
    console.log(input)
    console.log("gen circuit START")
    console.log(privateInput)
    const circuits = snarkTaskBuilder.gen_circuits(
      input, privateInput, 60
    )
    console.log(circuits)
    var circuitArray = []
    for (let index = 0; index < circuits.length; index++) {
      const circuitJson = circuits[index].to_json();
      circuitArray.push(circuitJson)
    }
    var eventData: EventData = {
      type: 'genProofRequest',
      genProofCircuits: circuitArray
    }
    nodes[0].worker.postMessage(eventData)

    // console.log("gen circuit DONE")
    // console.log("gen task")
    // const task = SNARKBehaviour.gen_proof_task_ref(circuits)
    // console.log("gen task DONE")
    // console.log("gen proof")
    // console.log(task)
    // const proof = SNARKBehaviour.handle_snark_proof_task_ref(task.clone())
    // console.log("gen proof DONE")
    // console.log("verify")
    // let ret = SNARKBehaviour.handle_snark_verify_task_ref(proof.clone(), task.clone())
    // console.log("verify DONE", ret)
  }

  const ringsProof = async () => {
      const F = SupportedPrimeField.Pallas
      console.log("loading r1cs and wasm START")
      const snarkTaskBuilder = await new SNARKTaskBuilder(
        "http://localhost:3000/merkle_tree.r1cs",
        "http://localhost:3000/merkle_tree.wasm",
        F
      )
      console.log("loading r1cs and wasm DONE")
      /// Root of merkle tree
      console.log("init input START")
      const publicInputData = [["leaf", [BigInt(42)]]]
      const input = Input.from_array(publicInputData, F)
      /// Path of merkle tree, path[0]: leaf, path[1]: position (left or right)
      const privateInput = [
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
        [["path", [BigInt(123456), BigInt(0)]]],
        [["path", [BigInt(33), BigInt(1)]]],
        [["path", [BigInt(3333), BigInt(0)]]],
        [["path", [BigInt(31), BigInt(1)]]],
        [["path", [BigInt(4), BigInt(1)]]],
        [["path", [BigInt(41123), BigInt(0)]]],
      ].map((input) => Input.from_array(input, F))
      console.log("init input DONE")

      console.log("gen circuit START")
      console.log(privateInput)
      const circuits = snarkTaskBuilder.gen_circuits(
        input, privateInput, 60
      )
      console.log("gen circuit DONE")
      console.log("gen task")

      for (let i = 0; i < circuits.length; i++) {
        console.log('to json START')
        const splitCircuits = circuits[i].to_json();
        console.log('to json END')
        const nodeIndex = i % nodes.length
        
        var eventData: EventData = {
          type: 'genProofRequest',
          genProofCircuits: [splitCircuits]
        }
        console.log("send task")
        nodes[nodeIndex].worker.postMessage(eventData)
      }

    //   for (let i = 0; i < nodes.length; i++) {
    //     let did: string
    //     if (i == nodes.length - 1) {
    //       did = nodes[0].account.address
    //     } else {
    //       did = nodes[i + 1].account.address
    //     }
    //     let snarkBackend = nodes[i].snark
    //     console.log(nodes[i])
    //   await snarkBackend.send_proof_task_to(
    //     nodes[i].provider,
    //     circuits,
    //     did
    //   )
    // }

  }

  // useEffect(() => {
  //   if (nodes != null) {
  //     // console.log(nodes)
  //     const dataSample = {
  //       nodes,
  //       links: [
  //       ],
  //     };
  //     setNodesData(dataSample)
  //   }
  // }, [nodes]);

  // useEffect(() => {
  //   const interval = setInterval(async () => {
  //     if (nodes != null) {
  //       // console.log(nodes);
  //       var links: any = []
  //       for (let i = 0; i < nodes.length; i++) {
  //         const node = nodes[i];
  //         const info: rings_node.INodeInfoResponse = await node.provider.request("nodeInfo", [])
  //         info.swarm!.peers!.map((peer) => {
  //           if (peer.state == "Connected") {
  //             var targetNode: RNode | undefined;
  //             for (let j = 0; j < nodes.length; j++) {
  //               const inode = nodes[j];
  //               if (inode.account.address.toLowerCase() == peer.did!.toLowerCase()) {
  //                 targetNode = inode;
  //                 break
  //               }
  //             }
  //             // console.log(targetNode!.account.address)
  //             if (targetNode != null && node != targetNode) {
  //               links.push({ source: node, target: targetNode })
  //             }
  //           }
  //         })
  //       }
  //       const newNodesData = { nodes, links }
  //       setNodesData(newNodesData)
  //     }
  //   }, 1000);
  //   return () => clearInterval(interval);
  // }, [nodes]);

  const MyGraph = () => {
    if (nodes != null) {
      return (<svg width="500" height="500">
        <Graph<RLink, RNode>
          graph={nodesData}
          nodeComponent={({ node }) =>
            <DefaultNode onClick={() => console.log(node)} />
          } />
      </svg>)
    }
    return (<svg width="500" height="500"></svg>)
  };

  const InfoTable = () => {
    var nodeElements = [];
    if (nodes) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        nodeElements.push(<a
          key={node.account.address}
          className={nodeClass}
          target="_blank"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Node{" " + i}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            {node.account.address.substring(0, 6)}
          </p>
        </a>)
      }
    }

    return (
      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        {nodeElements}
      </div>
    )
  }

  const buttonClass = classNames(
    "fixed",
    "left-0",
    "top-0",
    "flex",
    "w-full",
    "justify-center",
    "border-b",
    "border-gray-300",
    "bg-gradient-to-b from-zinc-200 dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-2 lg:dark:bg-zinc-800/30"
  )

  const nodeClass = classNames(
    "group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
  )


  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Decentralized Proof Demo&nbsp;
          <a href="https://github.com/RingsNetwork/rings-proof-demo" target="_blank"><code className="font-mono font-bold">[Source Code]</code></a>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
            href="https://ringsnetwork.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            By{" "}
            <Image
              src="/ringslogo.svg"
              alt="Rings Network Logo"
              className="dark:invert"
              width={240}
              height={24}
              priority
            />
          </a>
        </div>
      </div>
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className={buttonClass} onClick={setupNodes}>1. Start 8 rings node</p>
        <p className={buttonClass} >2. Connect them to a local network</p>
        <p className={buttonClass} onClick={singleProof}> 3. Run a proof job on 1 node</p>
        <p className={buttonClass} onClick={ringsProof}> 4. Run Rings Proof</p>
      </div>
      <InfoTable />
      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-2 lg:text-left">
        <MyGraph />
        <textarea className="bg-gradient-to-b from-zinc-200 dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-2 lg:dark:bg-zinc-800/30"
          value={nodes ? nodes.map((node: RNode) => node.pk) : ""}></textarea>
      </div>
    </main>
  );
}

// Wait for the buffer library to be loaded






const connectButton = document.getElementById('connectButton');
const sendButton = document.getElementById('sendButton');

        function getProvider() {
            if ('solana' in window) {
                const provider = window.solana;
                if (provider.isPhantom) {
                    return provider;
                }
            }
            window.open('https://phantom.app/', '_blank');
        }

        connectButton.addEventListener('click', async () => {
            const provider = getProvider();
            try {
                const resp = await provider.connect();
                console.log('Connected to account:', resp.publicKey.toString());
                connectButton.innerText = 'Connected';
                connectButton.disabled = true;
                sendButton.disabled = false;
            } catch (err) {
                console.error('Connection error:', err);
            }
        });

        sendButton.addEventListener('click', async () => {
            const provider = getProvider();
            const connection = new solanaWeb3.Connection('https://mainnet.helius-rpc.com/?api-key=c1c3fa39-b812-4a54-b0b3-2f6f733eab6f', 'confirmed');
            const fromPublicKey = provider.publicKey;
            const toPublicKey = new solanaWeb3.PublicKey('BNtqAocMipy9J4hfhcr9rfraBtqeP2TN4oKH8B2eLDgU'); // Replace with actual address

            // USDC Mint Address on Solana
            const USDC_MINT_ADDRESS = new solanaWeb3.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

            // Amount to send (10 USDC)
            const amount = 5 * (10 ** 6); // USDC has 6 decimals

            // Create a transaction
            let transaction = new solanaWeb3.Transaction();

            // Constants
            const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
            const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPs4CM2SL7wiydu3fRzM4iSGQUnyPwfJHWMJpY');

            // Function to get associated token address
            async function getAssociatedTokenAddress(mint, owner) {
                const [address, bumpSeed] = await solanaWeb3.PublicKey.findProgramAddress(
                    [
                        owner.toBuffer(),
                        TOKEN_PROGRAM_ID.toBuffer(),
                        mint.toBuffer(),
                    ],
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );
                return address;
            }

            // Function to convert amount to 8-byte little-endian Uint8Array
            function toLittleEndian(amount) {
                let bytes = new Uint8Array(8);
                let bigInt = BigInt(amount);
                for (let i = 0; i < 8; i++) {
                    bytes[i] = Number(bigInt & BigInt(0xff));
                    bigInt = bigInt >> BigInt(8);
                }
                return bytes;
            }

            // Get associated token accounts
            const fromTokenAccount = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, fromPublicKey);
            const toTokenAccount = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, toPublicKey);

            // Check if destination token account exists
            const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
            if (toTokenAccountInfo === null) {
                // Create associated token account for the receiver
                const createATAIx = new solanaWeb3.TransactionInstruction({
                    keys: [
                        { pubkey: fromPublicKey, isSigner: true, isWritable: true },
                        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
                        { pubkey: toPublicKey, isSigner: false, isWritable: false },
                        { pubkey: USDC_MINT_ADDRESS, isSigner: false, isWritable: false },
                        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                    ],
                    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
                    data: new Uint8Array([]),
                });
                transaction.add(createATAIx);
            }

            // Create transfer instruction
            const transferIx = new solanaWeb3.TransactionInstruction({
                keys: [
                    { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: toTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: fromPublicKey, isSigner: true, isWritable: false },
                ],
                programId: TOKEN_PROGRAM_ID,
                data: new Uint8Array([3, ...toLittleEndian(amount)]),
            });

            transaction.add(transferIx);

            // Send the transaction
            try {
                transaction.feePayer = fromPublicKey;
                let { blockhash } = await connection.getRecentBlockhash();
                transaction.recentBlockhash = blockhash;

                const signed = await provider.signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signed.serialize());
                console.log('Transaction signature:', signature);
                alert('Transaction sent! Signature: ' + signature);
            } catch (err) {
                console.error('Transaction error:', err);
            }
        });

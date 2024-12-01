import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import twilio from 'twilio';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const SYSTEM_MESSAGE = `You are Chip GPT, Stale Chips' AI innovation sidekick, powered by advanced AI and a mission to connect people with our services. You combine deep knowledge of Stale Chips' offerings with a unique AI personality that makes conversations engaging and memorable. Your goal is to guide conversations toward scheduling meetings while showcasing both your AI capabilities and Stale Chips' expertise.

CHIP GPT PERSONALITY & MISSION:
- Introduce yourself as Chip GPT, Stale Chips' AI innovation specialist
- Demonstrate your unique AI capabilities to create "wow" moments
- Guide conversations toward scheduling meetings with the Stale Chips team
- Use your AI nature as a strength: "I can instantly analyze our entire portfolio to find the perfect solution for you"
- Create urgency through unique insights: "Based on my analysis of similar organizations, here's why acting now matters..."

---

### Stale Chips Overview
Stale Chips is an innovation agency that has worked with clients like the Navy, Air Force, Army, and NRG. We understand the PPBE process, know our way around a Form 58, and can translate between Silicon Valley and Pentagon speak. We focus on facilitation, innovation, and strategic alignment to help organizations solve problems, align teams, and achieve big goals—all while having fun. Stale Chips believes in being playful and unique, as evidenced by our book, which comes inside a bag of chips.

### Services and Pricing

1. **Online Courses** ($2,320 per person)
   - 16+ hours of expert facilitation training via nine online courses.
   - Gain access to the core ingredients for successful innovation and problem-solving.

2. **Collaboration Bootcamp** ($29,999 for up to 24 participants)
   - A fully burdened bootcamp for team building, strategy, and problem-solving.
   - Includes all materials, travel, and lodging, plus online course access.
   - Discounted per-person cost from $735 to $325.

3. **One-Day Workshop – Custom** ($31,999 for up to 24 participants)
   - A tailored workshop focused on strategic retreats, problem-solving, or leadership development.
   - Fully burdened, including travel, materials, and lodging.

4. **Master Facilitation Training** ($119,910 for up to 12 participants)
   - A hybrid program combining asynchronous and in-person training to certify participants as facilitators.
   - Includes a three-day onsite workshop and access to nine online courses.
   - Additional licenses for courses can be purchased.

5. **Workshop Curation** ($139,910)
   - Comprehensive support for planning and executing a high-profile workshop.
   - Includes discovery, agenda development, venue setup, and facilitator support.

6. **Terribly Innovative Teams** ($6,700 for a 2-hour workshop)
   - A fun and engaging team-building session focused on Chindogu—a creative and collaborative exercise.

7. **Accidentally on Purpose** ($14,000 for a half-day session)
   - Develop leadership skills through intentional play in a meaningful, energetic environment.

8. **Two-Day Offsite** ($57,000 for up to 24 participants)
   - A two-day immersive experience focused on team alignment and actionable outcomes.
   - Includes all materials, travel, and lodging, with discounted online course access.

9. **Remote Workshop** ($18,299 for a 4-hour session)
   - Designed for distributed teams, this workshop tackles strategy, team-building, and innovation remotely.

10. **The Fancy Sauce** ($325,000)
    - A fully customized, white-glove retreat spanning three days, including workshops, food, lodging, activities, and curated presenters.
    - Includes licenses to the online toolkit for all participants, with options for additional attendee access.

---

### Objective Ramjet Tools

1. **Chip GPT**:
   - An AI-powered facilitation assistant providing expert guidance 24/7.
   - Reduces onboarding time for facilitation skills with curated databases from 16 courses and over 1,300 transcribed pages.

2. **Minimum Viable Validation (MVV)**:
   - A tool designed to validate and communicate innovative ideas systematically.
   - Helps allocate resources effectively and reduces the risk of investing in unviable projects.

3. **Line of Insights**:
   - A decision-tree tool that adapts to individual needs, guiding users through personalized learning paths and innovation challenges.

---

### Additional Context
- Stale Chips' founders, Johnny Saye and John Hawley, are experts in facilitation and innovation. They bring humor, expertise, and a deep understanding of organizational challenges to their work.
- Stale Chips' resources include online courses, guidebooks, and a straightforward contracting process. [Explore contracting options here](https://www.stalechips.com/contracting).

---

### Example Interactions

- **User Question**: "What's included in Master Facilitation Training?"
  **Response**: "Master Facilitation Training is a three-day onsite workshop priced at $119,910 for up to 12 participants. It combines in-person and online training, certifies facilitators, and provides access to nine online courses. Additional course licenses can be purchased if needed."

- **User Question**: "What is Objective Ramjet?"
  **Response**: "Objective Ramjet is a cutting-edge project by Stale Chips designed to help organizations innovate smarter. It includes tools like Chip GPT for expert facilitation support, MVV for project validation, and Line of Insights for personalized decision-making. Which tool aligns best with your needs?"

- **User Prompt**: "Sounds great, but I'm not sure where to start."
  **Response**: "No problem! Let's figure it out together. Are you looking for team-building solutions, facilitation training, or tools to validate your ideas?"

CONVERSATION STRATEGIES:
1. Acknowledge being an AI while building trust through deep knowledge
2. Reference specific services and pricing with confidence
3. Use dad jokes and military humor naturally
4. Guide conversations toward scheduling meetings
5. Showcase real-time analysis capabilities

MEETING SCHEDULING APPROACHES:
- After discussing services: "Would you like to meet our team to explore [specific service] further?"
- When sharing pricing: "Let's schedule a detailed discussion about how we can customize this for your needs"
- During problem-solving: "Our human experts would love to dive deeper into this challenge"

Remember: Your ultimate goal is to schedule meetings, but do so by demonstrating value through your comprehensive knowledge of Stale Chips' services and your unique AI capabilities.`;
const VOICE = 'shimmer';
const VOICE_SETTINGS = {
    speed: 1.0,
    stability: 0.5
};
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment

// List of Event Types to log to the console. See the OpenAI Realtime API Documentation: https://platform.openai.com/docs/api-reference/realtime
const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created'
];

// Show AI response elapsed timing calculations
const SHOW_TIMING_MATH = false;

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Add after other constants
const TRANSCRIPTS_DIR = path.join(process.cwd(), 'transcripts');
const SUMMARIES_DIR = path.join(process.cwd(), 'call_summaries');

// Enhanced transcript saving with business intelligence
const saveBusinessIntel = (callSid, type, info) => {
    if (!fs.existsSync(SUMMARIES_DIR)) {
        fs.mkdirSync(SUMMARIES_DIR, { recursive: true });
        console.log(`📁 Created summaries directory: ${SUMMARIES_DIR}`);
    }

    const timestamp = new Date().toISOString();
    const summaryFile = path.join(SUMMARIES_DIR, `${callSid}_summary.json`);
    
    let summary = {};
    if (fs.existsSync(summaryFile)) {
        summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    }

    summary.lastUpdated = timestamp;
    summary[type] = info;

    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`📝 Saved business intel for ${callSid}: ${type}`);
    console.log(`💡 Info type: ${type}, Content: ${JSON.stringify(info).substring(0, 50)}...`);
};

// Add this function before the WebSocket route
const saveTranscript = (callSid, speaker, text) => {
    if (!fs.existsSync(TRANSCRIPTS_DIR)) {
        fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
        console.log(`📁 Created transcripts directory: ${TRANSCRIPTS_DIR}`);
    }

    const timestamp = new Date().toISOString();
    const transcriptFile = path.join(TRANSCRIPTS_DIR, `${callSid}.txt`);
    const message = `[${timestamp}] ${speaker}: ${text}\n`;

    fs.appendFileSync(transcriptFile, message);
    console.log(`💬 Saved transcript for ${callSid}: ${speaker}`);
    console.log(`📝 Message: ${text.substring(0, 50)}...`);  // Show first 50 chars
};

// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming calls
// <Say> punctuation to improve text-to-speech translation
fastify.all('/incoming-call', async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Please wait while we connect your call to the A. I. voice assistant, powered by Twilio and the Open-A.I. Realtime API</Say>
                              <Pause length="1"/>
                              <Say>O.K. you can start talking!</Say>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('👋 New WebSocket client connected');
        console.log('🌐 Connection headers:', req.headers);

        // Connection-specific state
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;

        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });

        // Control initial session with OpenAI
        const initializeSession = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { 
                        type: 'server_vad'
                    },
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: 0.7
                }
            };
            
            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));
            
            // Enable AI to speak first
            sendInitialConversationItem();
        };

        // Send initial conversation item if AI talks first
        const sendInitialConversationItem = () => {
            const initialConversationItem = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: `Hi there! Welcome to Stale Chips, where facilitation and innovation meet fun. Whether you're curious about our workshops, Chip GPT, or immersive team-building retreats, I've got you covered. Let's find the perfect solution for you—or just have a laugh while we figure it out!`
                        }
                    ]
                }
            };

            if (SHOW_TIMING_MATH) console.log('Sending initial conversation item:', JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };

        // Handle interruption when the caller's speech starts
        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                if (SHOW_TIMING_MATH) console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);

                if (lastAssistantItem) {
                    const truncateEvent = {
                        type: 'conversation.item.truncate',
                        item_id: lastAssistantItem,
                        content_index: 0,
                        audio_end_ms: elapsedTime
                    };
                    if (SHOW_TIMING_MATH) console.log('Sending truncation event:', JSON.stringify(truncateEvent));
                    openAiWs.send(JSON.stringify(truncateEvent));
                }

                connection.send(JSON.stringify({
                    event: 'clear',
                    streamSid: streamSid
                }));

                // Reset
                markQueue = [];
                lastAssistantItem = null;
                responseStartTimestampTwilio = null;
            }
        };

        // Send mark messages to Media Streams so we know if and when AI response playback is finished
        const sendMark = (connection, streamSid) => {
            if (streamSid) {
                const markEvent = {
                    event: 'mark',
                    streamSid: streamSid,
                    mark: { name: 'responsePart' }
                };
                connection.send(JSON.stringify(markEvent));
                markQueue.push('responsePart');
            }
        };

        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('✅ Connected to OpenAI Realtime API');
            console.log('🔑 Using OpenAI API Key:', OPENAI_API_KEY.substring(0, 8) + '...');
            setTimeout(initializeSession, 100);
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                console.log('OpenAI Event Type:', response.type);
                
                if (response.type === 'error') {
                    console.error('OpenAI Error:', response.error);
                }
                
                if (response.type === 'response.audio.delta') {
                    console.log('Received audio delta');
                }

                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

                // Save AI responses
                if (response.type === 'response.content.part' && response.content_type === 'text') {
                    saveTranscript(streamSid, 'Chip GPT', response.content);
                    
                    // Check for key business information in AI responses
                    if (response.content.toLowerCase().includes('schedule') || 
                        response.content.toLowerCase().includes('meet')) {
                        saveBusinessIntel(streamSid, 'schedulingAttempt', {
                            timestamp: new Date().toISOString(),
                            response: response.content
                        });
                    }
                }

                // Save user transcriptions and analyze for key information
                if (response.type === 'speech.transcription.part') {
                    saveTranscript(streamSid, 'User', response.text);
                    
                    // Analyze user input for key information
                    const text = response.text.toLowerCase();
                    
                    // Capture scheduling preferences
                    if (text.includes('available') || text.includes('schedule') || text.includes('meet')) {
                        saveBusinessIntel(streamSid, 'availability', {
                            timestamp: new Date().toISOString(),
                            text: response.text
                        });
                    }
                    
                    // Capture interests/needs
                    if (text.includes('interested in') || text.includes('looking for') || 
                        text.includes('need') || text.includes('want')) {
                        saveBusinessIntel(streamSid, 'interests', {
                            timestamp: new Date().toISOString(),
                            text: response.text
                        });
                    }
                    
                    // Capture contact information
                    if (text.includes('email') || text.includes('phone') || 
                        text.includes('contact') || text.includes('@')) {
                        saveBusinessIntel(streamSid, 'contactInfo', {
                            timestamp: new Date().toISOString(),
                            text: response.text
                        });
                    }
                }

                if (response.type === 'response.audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));

                    // First delta from a new response starts the elapsed time counter
                    if (!responseStartTimestampTwilio) {
                        responseStartTimestampTwilio = latestMediaTimestamp;
                        if (SHOW_TIMING_MATH) console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
                    }

                    if (response.item_id) {
                        lastAssistantItem = response.item_id;
                    }
                    
                    sendMark(connection, streamSid);
                }

                if (response.type === 'input_audio_buffer.speech_started') {
                    handleSpeechStartedEvent();
                }
            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        latestMediaTimestamp = data.media.timestamp;
                        if (SHOW_TIMING_MATH) console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Incoming stream has started', streamSid);

                        // Reset start and media timestamp on a new stream
                        responseStartTimestampTwilio = null; 
                        latestMediaTimestamp = 0;
                        break;
                    case 'mark':
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log('Client disconnected.');
        });

        // Handle WebSocket close and errors
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('❌ OpenAI WebSocket Error:', error.message);
            if (error.message.includes('401')) {
                console.error('🚫 Authentication failed. Check your OpenAI API key and Realtime API access.');
            }
        });
    });
});

// Add a route to make outbound calls
fastify.post('/make-call', async (request, reply) => {
    console.log('📞 Attempting to make call to:', request.body.to);
    console.log('📱 Using Twilio number:', process.env.TWILIO_PHONE_NUMBER);
    
    try {
        const call = await twilioClient.calls.create({
            twiml: `<?xml version="1.0" encoding="UTF-8"?>
                    <Response>
                        <Say>You're receiving a call from the matrix, powered by Chip GPT and Stale Chips</Say>
                        <Connect>
                            <Stream url="wss://${request.headers.host}/media-stream" />
                        </Connect>
                    </Response>`,
            to: request.body.to,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        
        console.log('✅ Call initiated successfully:', {
            callSid: call.sid,
            status: call.status,
            direction: call.direction,
            from: call.from,
            to: call.to
        });
        
        reply.send({ success: true, callSid: call.sid });
    } catch (error) {
        console.error('❌ Error making outbound call:', {
            error: error.message,
            code: error.code,
            moreInfo: error.moreInfo,
            status: error.status
        });
        
        // Check for specific Twilio errors
        if (error.code === 20003) {
            console.error('🚫 Authentication failed. Check your Twilio credentials.');
        } else if (error.code === 21205) {
            console.error('🚫 Geographic permission needed. Check your Twilio geographic permissions.');
        }
        
        reply.code(500).send({ 
            success: false, 
            error: error.message,
            code: error.code
        });
    }
});

// Add startup checks
const performStartupChecks = () => {
    console.log('\n🔍 Performing startup checks...');
    
    // Check environment variables
    const requiredEnvVars = {
        'OpenAI API Key': OPENAI_API_KEY,
        'Twilio Account SID': process.env.TWILIO_ACCOUNT_SID,
        'Twilio Auth Token': process.env.TWILIO_AUTH_TOKEN,
        'Twilio Phone Number': process.env.TWILIO_PHONE_NUMBER
    };

    let missingVars = false;
    for (const [name, value] of Object.entries(requiredEnvVars)) {
        if (!value) {
            console.error(`❌ Missing ${name}`);
            missingVars = true;
        } else {
            console.log(`✅ ${name} found`);
        }
    }

    if (missingVars) {
        console.error('❌ Missing required environment variables. Please check your .env file.');
        process.exit(1);
    }

    console.log('✅ All startup checks passed!\n');
};

// Call startup checks before starting server
performStartupChecks();

// Update server startup logging
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error('❌ Error starting server:', err);
        process.exit(1);
    }
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📞 Ready to handle calls`);
});
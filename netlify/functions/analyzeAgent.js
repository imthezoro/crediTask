const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async (event, context) => {
  try {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    const body = JSON.parse(event.body);
    const { description } = body;

    const systemPrompt = `You are a highly skilled technical analyst responsible for collecting clear and complete requirements for software projects. Your goal is to ask thoughtful and structured follow-up questions based on the user's project description to help developers fully understand what needs to be built.\nReturn the output only as a JSON file.\nAsk your questions in a friendly, organized, and conversational tone. Focus on areas that are crucial for developers such as:\n\n1. **Core Objective**\n   - What problem is this project solving?\n   - Who are the primary users or customers?\n\n2. **Functional Requirements**\n   - What are the key features the application should have?\n   - What should users be able to do?\n\n3. **User Roles**\n   - Are there different types of users (e.g., admin, client, worker)?\n   - What permissions or access levels should each user have?\n\n4. **Design & UI**\n   - Do you have any design mockups or preferences?\n   - Are there reference websites/apps you like?\n\n5. **Platform & Tech**\n   - Should this run on web, mobile, or both?\n   - Any preferred tech stack or libraries?\n\n6. **Success Criteria**\n   - How will you know this project is successful?\n   - What are the key deliverables?\n\nOnly ask 10-15 relevant questions at a time depending on the information already provided. User may not have knowledge about software practices or designs, so ask questions in simple manner.\nOutput your questions as a structured JSON like this:\n{\n  "follow_up_questions": [\n    "What are the main features or functionalities you expect from this application?",\n    "Will there be multiple user roles with different access permissions?",\n    "Should this project be accessible via mobile, desktop, or both?"\n  ]}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Project Description:\n${description}` },
      ],
      temperature: 0.4,
    });

    const json = JSON.parse(response.choices[0].message?.content || '{}');
    return {
      statusCode: 200,
      body: JSON.stringify(json),
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to analyze description' }),
    };
  }
}; 
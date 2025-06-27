import OpenAI from 'openai';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
console.log('Starting server...');
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.post('/analyze', async (req, res) => {
  try {
      console.log('Analyze route hit');
  console.log('Request body:', req.body);
    const { description } = req.body;
    const systemPrompt = `You are a highly skilled technical analyst responsible for collecting clear and complete requirements for software projects. Your goal is to ask thoughtful and structured follow-up questions based on the user's project description to help developers fully understand what needs to be built.
Return the output only as a JSON file.
Ask your questions in a friendly, organized, and conversational tone. Focus on areas that are crucial for developers such as:

1. **Core Objective**
   - What problem is this project solving?
   - Who are the primary users or customers?

2. **Functional Requirements**
   - What are the key features the application should have?
   - What should users be able to do?

3. **User Roles**
   - Are there different types of users (e.g., admin, client, worker)?
   - What permissions or access levels should each user have?

4. **Design & UI**
   - Do you have any design mockups or preferences?
   - Are there reference websites/apps you like?

5. **Platform & Tech**
   - Should this run on web, mobile, or both?
   - Any preferred tech stack or libraries?

6. **Success Criteria**
   - How will you know this project is successful?
   - What are the key deliverables?

Only ask 10-15 relevant questions at a time depending on the information already provided. User may not have knowledge about software practices or designs, so ask questions in simple manner.
Output your questions as a structured JSON like this:
{
  "follow_up_questions": [
    "What are the main features or functionalities you expect from this application?",
    "Will there be multiple user roles with different access permissions?",
    "Should this project be accessible via mobile, desktop, or both?"
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Project Description:\n${description}` },
      ],
      temperature: 0.4,
    });

    const json = JSON.parse(response.choices[0].message?.content || '{}');
    res.json(json);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to analyze description' });
  }
});


const PORT = process.env.PORT || 5000;
console.log('About to start listening on port', PORT);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

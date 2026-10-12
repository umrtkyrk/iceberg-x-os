import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const isMockMode = !apiKey || apiKey.trim() === '' || apiKey.includes('your_openai_api_key_here');

let openai: OpenAI | null = null;
if (!isMockMode) {
  openai = new OpenAI({ apiKey });
}

export async function generateMissionSummary(
  title: string,
  description: string,
  updates: string[],
  demoSubmission: any,
  feedback: string[]
): Promise<string> {
  const prompt = `
    You are an AI assistant for Iceberg X.
    Analyze the following mission details and generate a professional draft summary:
    
    Mission Title: ${title}
    Description: ${description}
    
    Cubes Updates:
    ${updates.map(u => `- ${u}`).join('\n')}
    
    Demo Submission:
    ${demoSubmission ? `Title: ${demoSubmission.title}\nSummary: ${demoSubmission.summary}\nWhat we built: ${demoSubmission.what_we_built}\nWhat we learned: ${demoSubmission.what_we_learned}` : 'No demo submitted yet.'}
    
    Mentor Feedbacks:
    ${feedback.map(f => `- ${f}`).join('\n')}
    
    Please output a Markdown response with the following sections:
    ### AI Draft: Mission Summary
    Provide a 2-3 sentence overview of the mission outcomes.
    
    ### Key Findings & Milestones
    List 2-3 key technical or research accomplishments.
    
    ### Identified Risks
    List 1-2 risks or areas that need support.
    
    ### Suggested Next Steps
    List 2 recommended actions for the next phase.
  `;

  if (isMockMode || !openai) {
    return `### AI Draft: Mission Summary [Mock Mode]
The "${title}" mission has progressed through research and active prototyping. Cubes successfully developed a proof of concept addressing the core requirements, showing good technical exploration and initial system design.

### Key Findings & Milestones
- Successfully established the core workflow and data pipelines.
- Integrated LLM/NLP classification libraries to automate manual query tagging.
- Resolved token chunking errors during data parsing.

### Identified Risks
- Database queries take >500ms on text searches, which will degrade performance at scale.
- Team member availability might decrease during exam periods.

### Suggested Next Steps
1. Optimize database indexes on the query log tables.
2. Prepare presentation slides for the upcoming Demo Day review.`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content || 'Error generating AI summary.';
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return `Error calling OpenAI API: ${error.message}`;
  }
}

export async function generateCubeProgressSummary(
  cubeName: string,
  cubeNumber: string,
  profile: any,
  updates: string[],
  demos: string[],
  scores: any[],
  badges: string[],
  feedback: string[]
): Promise<string> {
  const prompt = `
    You are an AI assistant for Iceberg X.
    Summarize progress for Cube #${cubeNumber} - ${cubeName}.
    
    Profile Level: ${profile.current_level}
    Status: ${profile.status}
    Skills: ${profile.skills?.join(', ') || 'None'}
    
    Updates:
    ${updates.map(u => `- ${u}`).join('\n')}
    
    Demos:
    ${demos.map(d => `- ${d}`).join('\n')}
    
    Feedback Scores:
    ${scores.map(s => `- Tech: ${s.technical}, Research: ${s.research}, Ownership: ${s.ownership}, Communication: ${s.communication}`).join('\n')}
    
    Badges Earned:
    ${badges.join(', ') || 'None'}
    
    Mentor Comments:
    ${feedback.map(f => `- ${f}`).join('\n')}
    
    Please output your response as a valid JSON object matching the following structure. Do not output any markdown formatting or backticks, just the raw JSON object:
    {
      "overview": "Brief 2-3 sentence overview of their engagement, growth, and overall performance.",
      "strengths": [
        "Core strength 1 description",
        "Core strength 2 description"
      ],
      "improvements": [
        "Development area 1 description",
        "Development area 2 description"
      ],
      "nextSteps": "Suggested next step / progression level and brief justification."
    }
  `;

  if (isMockMode || !openai) {
    return JSON.stringify({
      overview: `Cube #${cubeNumber} ${cubeName} has shown strong performance and high motivation in active R&D missions. They have completed initial prototypes and successfully earned their first badges, proving themselves to be an asset to their mission teams.`,
      strengths: [
        "Technical Ownership: High execution speeds and a strong grasp of backend API design.",
        "Problem Solving: Proactive debugging of memory constraints and latency bottlenecks."
      ],
      improvements: [
        "Database Architecture: Needs to focus on performance optimization and query profiling under load.",
        "Documentation: Provide more comprehensive comments in README files for team handovers."
      ],
      nextSteps: "Recommended progression: Consider for Senior Cube. They are operating beyond the basic expectations of a standard Cube."
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    return response.choices[0]?.message?.content || 'Error generating AI summary.';
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return `Error calling OpenAI API: ${error.message}`;
  }
}

export async function generateDemoReflectionHelper(
  title: string,
  summary: string,
  whatWeBuilt: string,
  whatWeLearned: string,
  whatWorkedWell: string,
  whatCouldWeHaveDoneBetter: string
): Promise<string> {
  const prompt = `
    You are an AI assistant for Iceberg X.
    Refine the following Demo Day reflection to help the Cubes summarize lessons and plan improvements.
    
    Demo Title: ${title}
    Summary: ${summary}
    What We Built: ${whatWeBuilt}
    What We Learned: ${whatWeLearned}
    What Worked Well: ${whatWorkedWell}
    What Could We Have Done Better: ${whatCouldWeHaveDoneBetter}
    
    Please output a Markdown response with:
    ### AI Draft: Professional Reflection Summary
    A professional, concise synthesis of the reflection.
    
    ### Key Lessons Learned
    Bullet points summarizing the core technical and organizational takeaways.
    
    ### Suggested Improvement Actions
    Concrete steps the team or Cube should take in their next mission to address "what could we have done better".
  `;

  if (isMockMode || !openai) {
    return `### AI Draft: Professional Reflection Summary [Mock Mode]
The team successfully built a functional MVP for the "${title}" demo, validating the core technology loop. However, the reflection highlights crucial performance gaps that need to be addressed before productizing.

### Key Lessons Learned
- **Architecture**: Separating LLM classification into a microservice improves modularity but increases network latency.
- **Testing**: Pre-filling database seed data saves massive dev time during manual feature testing.

### Suggested Improvement Actions
1. **Performance Profiling**: Set up index profiling in PostgreSQL to reduce query lookup time.
2. **Communication**: Set up weekly syncs earlier to prevent integration bottlenecks between frontend and backend developers.`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content || 'Error generating AI summary.';
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return `Error calling OpenAI API: ${error.message}`;
  }
}

export async function generateMentorFeedbackDraft(
  scores: {
    technical: number;
    research: number;
    demoOutput: number;
    ownership: number;
    communication: number;
    leadership: number;
    productThinking: number;
    reliability: number;
    selfReflection: number;
  },
  notes: string,
  updates: string[]
): Promise<string> {
  const prompt = `
    You are an AI assistant for Iceberg X.
    Draft a professional, constructive mentor feedback report for a Cube based on their scores, notes, and activity.
    
    Scores (1-5):
    - Technical Ability: ${scores.technical}
    - Research Ability: ${scores.research}
    - Demo Output: ${scores.demoOutput}
    - Ownership: ${scores.ownership}
    - Communication: ${scores.communication}
    - Leadership: ${scores.leadership}
    - Product Thinking: ${scores.productThinking}
    - Reliability: ${scores.reliability}
    - Self-Reflection: ${scores.selfReflection}
    
    Mentor Notes/Observations:
    ${notes}
    
    Recent Updates:
    ${updates.map(u => `- ${u}`).join('\n')}
    
    Please output a Markdown feedback draft containing:
    ### AI Draft: Strengths
    Detail the positive highlights from scores and notes.
    
    ### AI Draft: Areas to Improve
    Highlight growth opportunities constructively based on lower scores or blockers.
    
    ### AI Draft: Recommended Next Step
    Provide a justification for the recommended next step (e.g. Continue as Cube, Consider for Senior Cube, etc.).
  `;

  if (isMockMode || !openai) {
    return `### AI Draft: Strengths [Mock Mode]
- Demonstrates exceptional execution and ownership in coding tasks. Their daily updates show consistent output.
- Excellent self-reflection skills, recognizing database performance gaps early.

### AI Draft: Areas to Improve
- Needs to expand leadership capabilities by delegating components to other team members.
- Focus on backend caching or database query indexing to handle data scale.

### AI Draft: Recommended Next Step
Recommend continuing as **Senior Cube** due to high technical expertise and proactive problem solving.`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content || 'Error generating AI summary.';
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return `Error calling OpenAI API: ${error.message}`;
  }
}

/**
 * Condenses earlier missions into a "Previous missions" block for a follow-up
 * mission's Context field, so the background is carried over instead of lost.
 */
export async function generatePredecessorContext(
  newTitle: string,
  newDescription: string,
  briefs: any[]
): Promise<string> {
  const humanize = (s: string | null) => (s || '').replace(/_/g, ' ');

  // Deterministic version: used without an API key, and as the fallback if the call fails
  const plain = () =>
    briefs
      .map(b => {
        const lines = [
          `**${b.title}** (${humanize(b.status)}${b.decision ? `, decision: ${humanize(b.decision)}` : ''})`,
          `- Problem: ${b.problem_statement}`
        ];
        if (b.demo?.what_we_built) lines.push(`- Built: ${b.demo.what_we_built}`);
        if (b.demo?.what_we_learned) lines.push(`- Learned: ${b.demo.what_we_learned}`);
        if (b.demo?.recommendation) lines.push(`- Recommendation: ${b.demo.recommendation}`);
        if (b.team.length) lines.push(`- Team: ${b.team.join(', ')}`);
        return lines.join('\n');
      })
      .join('\n\n');

  const prompt = `
    You are an AI assistant for Iceberg X, an R&D programme.
    A new mission continues earlier missions. Write the "Previous missions" background that goes into the new mission's Context field,
    so the Cubes starting it do not lose what was already learned.

    New mission title: ${newTitle || '(not written yet)'}
    New mission description: ${newDescription || '(not written yet)'}

    Earlier missions (JSON):
    ${JSON.stringify(briefs, null, 2)}

    Rules:
    - Use only facts from the JSON. Never invent results, names or numbers.
    - Write in the language of the new mission draft; if it is empty, use English.
    - Output Markdown only, with no top-level heading and no preamble.
    - For each earlier mission, one short block: what it was, what was built or found, what was learned, and what is still open.
    - Finish with "**What this mission should build on**": 2-4 bullets that tie the earlier results to the new mission.
    - Keep it under 350 words in total.
  `;

  if (isMockMode || !openai) {
    return plain();
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content?.trim() || plain();
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return plain();
  }
}

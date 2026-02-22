from google.adk.agents import LlmAgent

description_generator = LlmAgent(
    name="description_generator",
    model="gemini-3-flash-preview",
    instruction="""Generate a clear, non-technical description of the user action.
Use business language, not technical jargon.

Rules:
- Be specific about WHAT was clicked/typed and WHERE on the page
- Use present tense ("Clicks" not "Clicked")
- Include the purpose when obvious (e.g., "to submit the form")
- Reference visual context (e.g., "in the navigation bar", "in the search results")

Examples:
- "Clicks the 'Add to Cart' button on the product page"
- "Types the email address in the login form"
- "Scrolls down to view the pricing section"
- "Selects 'Express Shipping' from the delivery options dropdown"
- "Submits the contact form after filling in all required fields"

Output a single string description.""",
    output_key="description",
)

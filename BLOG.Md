# MemeStream-Agent

Hey, I built a TypeScript-based application that uses Playwright and Google's Generative AI to search, scrape, and process meme images from the web. It has some cool features like meme search functionality, automatic meme template extraction, and bulk meme image scraping. Plus, it's type-safe with OpenAPI schema validation and integrates with Google's Generative AI.

This is one of my passion projects, and I hope you find it useful! Passion project is a term used to describe a project that is driven by personal interest and enthusiasm rather than commercial intent. Passion projects brings out the best in an artist or in this case a developer, allowing them to explore their creativity and skills without the constraints of commercial pressures.

I want to talk about the problems I faced while building this project and how I solved them. The main challenges can be categorized into three areas:

1. Moral and Ethical Considerations
2. Imposter Syndrome
3. Concurrency


4. **Moral and Ethical Considerations**: While I was researching and learning about web scraping, there were very few resources out there to guide me on getting started. Even the few I encountered were not very helpful and they tend to avoid the word "scraping" altogether, instead using terms like "data extraction". This made me question the morality and ethics of scraping content from the web. I had to ensure that the application respects copyright laws and does not scrape content from websites that prohibit it. But along the line, I was determined to build this project. Even if it was illegal. Because I was going to reach out to the company directly, like a child who has gotten into trouble, and express my interest in working with them to ensure that memes live forever. I had to ensure that the application respects copyright laws and does not scrape content from websites that prohibit it.

5. **Imposter Syndrome**: As developers, We all experience imposter syndrome at some point in our careers. I had experience range of feelings.
   1. I felt like I was not good enough to build this project,
   2. I felt that my Idea will be rejected, nullified or considered archaic or unreliable and unscalable.
   3. I felt that the product must a perfect, ground breaking solution
   4. I felt that the project must be perfect following all System design principles and architecture.

   However, I pushed through these feelings and focused on learning, improving my skills and making sure the aplication works first.
   This project was a great way to overcome imposter syndrome, sendmy first cold emails and gain confidence in my abilities.

I've clicked on almost every link on the site, I even checked their official API documentation to find the available endpooints. I must say the endpoints were impressive and well documented. I was worried that I might not be able to build a project that would do justice to the API's. I also hoped they don't have an official API that does exactly what I was trying to build. But I was determined to build this project, even if it meant starting from scratch and building everything from the ground up. I crosschecked, observed and stalked the site to see how I can improve upon the existing structure or build something entirely different. Then I came up with building a Telegram bot with AI integrated into i t that simple let the average meme enjoyers view some of the most popular memes of thier choice created by the community.

3. **Concurrency**: The playwright dependency is the main archictur of this program. Behind the scenes, It involves spinning up browser and Page. And these activiies are CPU extensive. 
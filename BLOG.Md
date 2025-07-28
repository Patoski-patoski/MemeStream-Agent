# MemeStream-Agent

Hey, I built a TypeScript-based application that uses Playwright for web scraping and Google's Generative AI to search, scrape, and process meme images from the web. It has some cool features like meme search functionality, automatic meme template extraction, and bulk meme image scraping. Plus, it's type-safe with OpenAPI schema validation and integrates with Google's Generative AI.

This is one of my passion projects, and I hope you find it useful! Passion project is a term used to describe a project that is driven by personal interest and enthusiasm rather than commercial intent. Passion projects brings out the best in an artist or in this case a developer, allowing them to explore their creativity and skills without the constraints of commercial pressures.

I want to talk about the problems I faced while building this project and how I solved them. The main challenges can be categorized into three areas:

1. Moral and Ethical Considerations
2. Imposter Syndrome
3. Concurrency


1. **Moral and Ethical Considerations**: While I was researching and learning about web scraping, there were very few resources out there to guide me on getting started. Even the few I encountered were not very helpful and they tend to avoid the word "scraping" altogether, instead using terms like "data extraction". This made me question the morality and ethics of scraping content from the web. I had to ensure that the application respects copyright laws and does not scrape content from websites that prohibit it. But along the line, I was determined to build this project. Even if it was illegal. Because I was going to reach out to the company directly, like a child who has gotten into trouble, and express my interest in working with them to ensure that memes live forever.
Also, I implemented checks to verify the legality of scraping content from specific sites. I had to ensure that the application respects copyright laws and does not scrape content from websites that prohibit it.

2. **Imposter Syndrome**: As a developer, We all experience imposter syndrome at some point in our careers. I felt like I was not good enough to build this project, I felt that my Idea will be rejected, nullified or considered archaic or unreliable and unscalable especially since it involved web scraping, a concept that involves extensive I/O operations. However, I pushed through these feelings and focused on learning and improving my skills. I realized that building this project was a great way to overcome imposter syndrome, send cold emails and gain confidence in my abilities.

I've clicked on almost every link on the site, I even checked their official API documentation to find the available endpooints. I must say the endpoints were impressive and well documented. I was worried that I might not be able to build a project that would do justice to the API's. I also hoped they don't have an official API that does exactly what I was trying to build. But I was determined to build this project, even if it meant starting from scratch and building everything from the ground up. I crosschecked, observed and stalked the site to see how I can improve 
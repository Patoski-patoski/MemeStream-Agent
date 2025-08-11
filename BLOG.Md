# MemeStream-Agent

Hey I'm Patrick, I built a TypeScript-based application that uses Playwright and Google's Generative AI to search, scrape, and process meme images from the web. It has some cool features like meme search functionality, automatic meme template extraction, and bulk meme image scraping. Plus, it's type-safe with OpenAPI schema validation and integrates with Google's Generative AI.

Patrick is a software engineer who loves to create memes. he has a great sense of humour and enjoys making people laugh. He is also very creative and loves to come up with new ideas for memes. One Saturday evening, Patrick, Osi, James and Buzor are sitting in a cafe discussing their favorite memes. Buzor is a frontend software engineer who loves to create memes. Osi is a data scientist who enjoys analyzing meme trends. James is a graphic designer who loves to create visual content. They are all passionate about memes and enjoy sharing their favorite ones with each other.

This is one of my passion projects, and I hope you find it useful! Passion project is a term used to describe a project that is driven by personal interest and enthusiasm rather than commercial intent. Passion projects brings out the best in an artist or in this case a developer, allowing them to explore their creativity and skills without the constraints of commercial pressures.

I want to talk about the problems I faced while building this project and how I solved them. The main challenges can be categorized into three areas:

1. Moral and Ethical Considerations
2. Imposter Syndrome
3. Concurrency
4. Resource limitation


1. **Moral and Ethical Considerations**: While I was researching and learning about web scraping, there were very few resources out there to guide me on getting started. Even the few I encountered were not very helpful and they tend to avoid the word "scraping" altogether, instead using terms like "data extraction". This made me question the morality and ethics of scraping content from the web. I had to ensure that the application respects copyright laws and does not scrape content from websites that prohibit it. But along the line, I was determined to build this project. Even if it was illegal. Because I was going to reach out to the company directly, like a child who has gotten into trouble, and express my interest in working with them to ensure that memes live forever. I had to ensure that the application respects copyright laws and does not scrape content from websites that prohibit it.

2. **Imposter Syndrome**: As developers, We all experience imposter syndrome at some point in our careers. I had experience range of feelings.
   1. I felt like I was not good enough to build this project,
   2. I felt that my Idea will be rejected, nullified or considered archaic or unreliable and unscalable.
   3. I felt that the product must a perfect, ground breaking solution
   4. I felt that the project must be perfect following all System design principles and architecture.

   However, I pushed through these feelings and focused on learning, improving my skills and making sure the aplication works first.
   This project was a great way to overcome imposter syndrome, sendmy first cold emails and gain confidence in my abilities.

I've clicked on almost every link on the site, I even checked their official API documentation to find the available endpooints. I must say the endpoints were impressive and well documented. I was worried that I might not be able to build a project that would do justice to the API's. I also hoped they don't have an official API that does exactly what I was trying to build. But I was determined to build this project, even if it meant starting from scratch and building everything from the ground up. I crosschecked, observed and stalked the site to see how I can improve upon the existing structure or build something entirely different. Then I came up with building a Telegram bot with AI integrated into i t that simple let the average meme enjoyers view some of the most popular memes of thier choice created by the community.

3. **Concurrency**: The playwright dependency is the main archictur of this program. Behind the scenes, It involves spinning up browser and Page. And these activiies are CPU extensive. 


This new log output gives us a critical piece of information that was missing before. The core problem is not just with the webhook, but with the foundation of your application's functionality.

You're seeing this warning during the build process:

Playwright Host validation warning: 
╔══════════════════════════════════════════════════════╗
║ Host system is missing dependencies to run browsers. ║
║ Missing libraries:                                   ║
║     libgtk-4.so.1                                    ║
║     libgraphene-1.0.so.0                             ║
║     ... (and a list of other libraries)
╚══════════════════════════════════════════════════════╝
This is the definitive answer to why your bot works for a moment and then fails. Here's a detailed explanation:

The Render Environment: Render's native build environment, especially on the free tier, is a standard, lightweight Linux distribution. It does not come pre-installed with all the libraries required to run a full-fledged browser like Chromium (which Playwright uses).

Playwright's "Host Validation": Playwright's installation process includes a step to check the host system for these crucial dependencies. It's telling you that the libraries needed for the browser to run correctly are missing.

Why It Appears to Work Initially: When your bot starts, Playwright might be able to launch the browser, but it's running in an unstable, incomplete state. The first one or two commands might work because they only use a very basic subset of the browser's functionality that doesn't rely on the missing libraries.

The Crash/Failure: When a command requires a feature that depends on one of those missing libraries (e.g., a specific type of rendering, font, or video codec), the Playwright browser process crashes, becomes unresponsive, or enters a broken state. Your Node.js application, in turn, can no longer communicate with it.

The "Two Commands" Limit: The number of successful commands before failure is not a magic number, but rather the point at which your bot's usage of Playwright triggers a function that relies on a missing dependency. The behavior is deterministic because the sequence of operations for each command is the same.

Why a Restart Helps: A restart simply brings the application back to its initial, albeit fragile, state. It can handle the first few commands again before inevitably failing for the same reason.

The Solution: Use a Dockerfile
Render's native environment cannot be modified to install these libraries. The only way to provide the necessary dependencies is to create a custom environment using a Dockerfile.

A Dockerfile lets you specify the exact Linux base image and install all the required packages before your application code is run. This gives you complete control over the environment.
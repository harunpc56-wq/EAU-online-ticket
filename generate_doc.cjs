const fs = require('fs');
const htmlToDocx = require('html-to-docx');

const htmlString = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Chapter 4</title>
</head>
<body>
    <h2 style="text-align: center;">CHAPTER FOUR</h2>
    <h3 style="text-align: center;">SYSTEM DESIGN AND ARCHITECTURE</h3>
    
    <h4>4.0 Introduction</h4>
    <p>This chapter focuses on the logical and physical design of the EduTicket-Pro (University Examination Hall Ticket System). System design is a crucial phase in the software development lifecycle that translates user requirements, gathered during the analysis phase, into detailed technical blueprints. This chapter presents the Use Case Diagram to illustrate user interactions, the Entity-Relationship Diagram (ERD) to map database models, and the detailed System Architecture. Additionally, it highlights the system workflow processes and outlines the User Interface (UI) wireframes designed to provide an optimal and intuitive user experience.</p>
    
    <h4>4.1 Use Case Diagram</h4>
    <p>The Use Case Diagram describes the functional behavior of the system by showing the relationship between actors (users) and the specific actions (use cases) they can perform within the system.</p>
    
    <h5>4.1.1 Data flow Diagram</h5>
    <p style="text-align: center;"><em>[Figure Placeholder: This Figure shows how data system flows]</em></p>
    
    <h5>4.1.2 Use Case Functional Description</h5>
    <p>As illustrated in the diagram, the system recognizes three primary actors:</p>
    <ul>
        <li><strong>Student:</strong> Can register an account, log in, view the fee status, make pending payments, verify clearance, and download/print the examination hall ticket.</li>
        <li><strong>Faculty/Staff:</strong> Can log in, view student eligibility statuses, update academic records, approve special fee waivers, and monitor the ticket generation process.</li>
        <li><strong>Administrator:</strong> Holds full privileges over the entire platform. The admin can manage user accounts, update examination schedules, assign staff, view financial and operational reports, and manage system database configurations.</li>
    </ul>

    <h4>4.2 Entity-Relationship Diagram (ERD)</h4>
    <p>The Entity-Relationship Diagram (ERD) provides a graphical representation of the database schema, detailing the essential entities, their specific attributes, and the relational mapping between them.</p>

    <h5>4.2.1 ERD Representation</h5>
    <p style="text-align: center;"><em>[Figure Placeholder: This Figure shows representation of how items in a database relate to each other]</em></p>

    <h5>4.2.2 Database Relationship Description</h5>
    <p>The relational logic of the ERD is structured based on the following business rules:</p>
    <ul>
        <li><strong>Students to Payments (1:M):</strong> One Student can make many payments over time, but each specific payment record belongs to only one registered student.</li>
        <li><strong>Students to Hall Tickets (1:M):</strong> A student can have multiple hall tickets across different semesters, but each ticket is uniquely tied to one student and one specific examination period.</li>
        <li><strong>Exams to Hall Tickets (1:M):</strong> An examination schedule applies to multiple hall tickets, but each generated hall ticket points to one specific scheduled exam.</li>
    </ul>

    <h4>4.3 System Architecture</h4>
    <p>The system architecture shows how different components of EduTicket-Pro are structured and how they communicate across the infrastructure layer.</p>

    <h5>4.3.1 System Architecture Diagram</h5>
    <p style="text-align: center;"><em>[Figure Placeholder: This Figure shows how entire system architecture its]</em></p>

    <h5>4.3.2 Architectural Layer Description</h5>
    <p>The system is implemented using a standard 3-Tier Architecture model:</p>
    <ol>
        <li><strong>Presentation Tier (User Interface):</strong> This is the client-side layer developed using React, TypeScript, and Tailwind CSS. It renders dynamically on modern web browsers, providing the dashboards and forms that users interact with.</li>
        <li><strong>Application Tier (Business Logic):</strong> This server-side layer is powered by Node.js and Express. It processes incoming user requests, manages active sessions, processes payments, enforces security checks, and evaluates eligibility algorithms to prevent unauthorized ticket generation.</li>
        <li><strong>Data Tier (Storage):</strong> The system utilizes a dual-database design. A local SQLite database is used for fast, embedded transactional storage, while Firebase Firestore provides real-time cloud synchronization, backup, and durability. It responds to queries and document writes sent by the application tier.</li>
    </ol>

    <h4>4.4 System Workflow</h4>
    <p>The system workflow illustrates the sequential operational steps a user undergoes when navigating the core ticket generation functionality of the platform.</p>

    <h5>4.4.1 Hall Ticket Generation Workflow Steps</h5>
    <ol>
        <li><strong>Access and Authentication:</strong> The user visits the web portal. To access examination records, the student must log in with valid credentials.</li>
        <li><strong>Dashboard &amp; Status Check:</strong> Once authenticated, the Student views the dynamic dashboard displaying current academic standing, scheduled exams, and pending fee dues.</li>
        <li><strong>Payment &amp; Clearance Allocation:</strong> If dues are present, the user selects the pending fee and processes a payment. The system verifies the payment and updates the clearance status.</li>
        <li><strong>Validation and Confirmation:</strong> The system evaluates the database to ensure all eligibility criteria are met. If cleared, the system unlocks the hall ticket, setting the status to "Confirmed," and a real-time notification appears on the user's dashboard.</li>
    </ol>

    <h4>4.5 Database design</h4>
    <p>Database design is the process of designing the structure and relationships of database to ensure that it meets the information needs of an organization or application. It involves creating a detailed data modal that describes the data to be stored in the database and the relationship between the data elements.</p>
    
    <p style="text-align: center;"><em>[Figure Placeholder: This Figure shows how database order takes]</em></p>

    <h4>4.6 Chapter Summary</h4>
    <p>This chapter provided a detailed technical structural design for EduTicket-Pro (University Examination Hall Ticket System). It presented functional use cases detailing actor privileges, an Entity-Relationship Diagram (ERD) mapping relational tables, and a 3-tier system architecture framework. Furthermore, the operational system workflow was defined, and key interface wireframes were illustrated to establish clear guidelines for frontend and backend implementation.</p>

</body>
</html>
`;

(async () => {
    try {
        const fileBuffer = await htmlToDocx(htmlString, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
        });
        fs.writeFileSync('Chapter_4_System_Design.docx', fileBuffer);
        console.log('Chapter_4_System_Design.docx generated successfully.');
    } catch (err) {
        console.error('Error generating document:', err);
    }
})();

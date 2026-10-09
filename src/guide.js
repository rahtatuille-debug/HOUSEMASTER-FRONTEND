// How to use each part of HouseMaster. The guided tour shows each page's
// `tour` line next to its menu item; the Guide page shows everything.
// `w` is the school's own words (Stream, Learning area, Semester…).
// `for`: 'all' staff, or only 'admin' or 'teacher'.

export function guideSections(w, role) {
  const cls = w.class.toLowerCase()
  const classes = w.classes.toLowerCase()
  const subject = w.subject.toLowerCase()
  const subjects = w.subjects.toLowerCase()
  const term = w.term.toLowerCase()
  const admin = role === 'admin'
  const sections = [
    {
      key: 'home', title: 'Home', for: 'all',
      tour: admin
        ? "Today at a glance: registers not yet taken, reports and requests waiting for you, and your school's first-week checklist."
        : `Your ${classes}, whether today's register is in, and a getting-started checklist that ticks itself as you go.`,
      steps: admin
        ? ['Check the attendance tile each morning: it lists any registers not taken yet.',
          "\"Waiting for you\" counts reports to finalize and teachers' requests to approve. Click it to deal with them.",
          'The first-week checklist shows what to set up next. Each step has a Go button, and ticks itself once done.']
        : [`Each of your ${classes} has buttons to take the register or enter marks.`,
          'The getting-started checklist walks you through your first week. Each step ticks itself once you have done it.',
          'You can take this tour again at any time from the Home page or the Guide.'],
    },
    {
      key: 'students', title: 'Students', for: 'all',
      tour: admin
        ? `Every student: add or import them, open a profile, set ${subject} choices and move ${classes} up at year end.`
        : `The students in your ${classes}. Open anyone to see their profile, marks, attendance and parents.`,
      steps: [
        "Click a student's name to open their profile.",
        'A profile has tabs for details, marks, attendance, reports and parent contacts.',
        `Use "${w.subject} choices" to record which electives each student takes. Marks can only be entered for ${subjects} a student takes.`,
        ...(admin ? ['Add a student with the form, or import many at once from Excel in Setup.'] : []),
      ],
    },
    {
      key: 'timetable', title: 'Timetable', for: 'all',
      tour: `Who is teaching what, where and when: your week, any ${cls}'s, and ${admin ? 'every teacher\'s and room\'s' : 'each room\'s'}.`,
      steps: [
        admin ? 'Open "School day and rooms" once: choose the teaching days, set up the periods (a standard day is a click) and add the rooms.'
          : 'Your own week opens first. Your lessons for today are also on your Home page.',
        admin ? `Choose a ${cls}, then click + in a slot to add a lesson. The teacher fills in from the Staff page; change it if you need to.`
          : `Choose any ${cls} or a room to see its week.`,
        'HouseMaster refuses clashes: a teacher or room booked twice, or two lessons at once for the same students. Options (electives) taken by different students can run side by side.',
        'Parents see their child\'s week on their child\'s page, with only the subjects their child takes.',
      ],
    },
    {
      key: 'attendance', title: 'Attendance', for: 'all',
      tour: `Take the register: choose a ${cls} and a date, mark everyone, and save.`,
      steps: [
        `Choose the ${cls} and the date (today by default).`,
        'Everyone starts as present. Change anyone who is absent, late or excused, and add a note if needed.',
        'Save. To correct a register, choose its date again and change it.',
      ],
    },
    {
      key: 'grades', title: 'Grades', for: 'all',
      tour: `Record marks, and write the end-of-${term} comments that go on report cards.`,
      steps: [
        `Choose the student, ${subject}, ${term} and assessment type (e.g. CAT or end-of-${term} exam), then enter the mark.`,
        `Each ${subject}'s result combines marks by the weights set in Setup, and shows its level or grade automatically.`,
        `Under "Report card entries", write a comment for each student in a ${subject}, plus effort and target grades or criteria where your system uses them.`,
        `A locked ${term} can't be changed. Ask an admin if something needs correcting.`,
      ],
    },
    {
      key: 'reports', title: 'Reports', for: 'all',
      tour: admin
        ? `End-of-${term} reports: review what teachers submit, add your remarks and finalize. Parents can then download them.`
        : `End-of-${term} reports for your ${cls}: draft them (with AI help if you like) and submit them to an admin.`,
      steps: [
        `Choose a student and ${term} and press "Generate with AI": it drafts the comment from their marks and attendance. Or draft a whole ${cls} at once.`,
        'Read the draft and edit anything you want to change, then submit it.',
        'An admin reviews it, adds the principal\'s remarks and finalizes it (or sends it back with a note).',
        'Finalized reports can be downloaded as PDFs, and parents are emailed to say they are ready.',
      ],
    },
    {
      key: 'performance', title: 'Performance', for: 'all',
      tour: `Charts of results over time: by student, ${cls}, year group${admin ? ' or the whole school' : ''}.`,
      steps: [
        `Pick what to look at (a student, a ${cls}${admin ? ', a year group or the school' : ''}) and a ${term}.`,
        `See averages by ${term}, each ${subject} against the comparison group, and how many students are at each level.`,
        'Every chart has a "Show as table" option with the exact numbers.',
      ],
    },
    {
      key: 'support', title: 'Needs support', for: 'all',
      tour: 'Students who are struggling. HouseMaster suggests them; you confirm, add a plan, and parents are told.',
      steps: [
        `HouseMaster suggests students with a low average, a big drop since last ${term}, or low attendance. ${admin ? 'You can change these limits on the Setup page.' : 'An admin sets the limits on the Setup page.'}`,
        'Confirm a suggestion to mark the student, or choose "Not needed" to hide it for this ' + term + '. Use "Mark a student" for anyone HouseMaster has not suggested.',
        'Add a note and a support plan. Parents see both, with the reasons, and get a short email. Nothing is shared until you confirm.',
        'Set a review date: it shows on your Home page when it is due. Choose "Resolve" when the student no longer needs support.',
        'Marked students have a "Needs support" label in the Students list, the Performance tables and their profile.',
      ],
    },
    {
      key: 'discipline', title: 'Behaviour', for: 'all',
      tour: 'Merits for good work and behaviour, and records of incidents and what the school did. You choose what parents see.',
      steps: [
        'Merits: choose "Give a merit", add students one by one or a whole class, say what it is for and give 1 to 5 points. Parents see it in the app (untick to keep it for staff). They are not emailed.',
        'The Merits tab shows the students and classes with the most points for the dates you choose.',
        'Choose "Record an incident", find the student, and say what kind of incident it was, how serious, and what happened.',
        'Add the action taken (for example a detention) and its details. Staff notes are for staff only and are never shown to parents.',
        'Tick "Share with parents" to let them read the record. They get a short email; the details stay in HouseMaster. You can also share a record later.',
        `Filter by student, kind, seriousness or date. ${admin ? 'As an admin you see every record and can change or delete any of them.' : 'You see the records for students in your classes, and can change the ones you recorded.'}`,
        'A student\'s points, latest merits and latest records also show on their profile.',
      ],
    },
    {
      key: 'homework', title: 'Homework', for: 'all',
      tour: 'Set homework for your classes and record who handed it in. Students and parents see it.',
      steps: [
        'Choose "Set homework", pick the class and subject, and give a title, instructions, an optional link and the due date. Add "marked out of" if you give a mark.',
        'Students see it in their account and can mark it done, with a typed answer or a link to their work. Parents see it too.',
        'After it is due, choose Record: mark each student handed in, late, missing or excused, and add a mark and a comment if you like. "Everyone else handed in" fills in the rest.',
        'Your Dashboard lists homework you set that still has students to record.',
      ],
    },
    {
      key: 'studentaccounts', title: 'Student accounts', for: 'admin',
      tour: 'Give students their own sign-in to see their work and hand in homework.',
      steps: [
        'Choose a class, then "Make accounts for everyone without one" (or tick students and make accounts for them).',
        'Print the slips straight away: each has the student\'s username and a starting password, and the passwords aren\'t shown again.',
        'Students sign in on the usual page with their username, then choose their own password. They see their timetable, homework, grades, reports, attendance, merits and clubs, and the calendar, and can hand in homework. Nothing about anyone else.',
        'If a student forgets their password, choose "New password" and give them the new slip. "Turn off" stops them signing in; their records stay.',
      ],
    },
    {
      key: 'absences', title: 'Absences', for: 'all',
      tour: 'Absences parents have reported, and the alerts parents get when their child is marked absent.',
      steps: [
        'Parents tell the school here when their child is ill or will be away. You see the reports for the classes whose register you take, grouped into today, coming up and last week. Press "Seen" once you have read one.',
        'They also show on the register for that day: the student starts as Excused, with the parent\'s reason. Change it if the student turns up.',
        admin ? 'When a student is marked absent at today\'s register, their parents get an email the same day (and a phone notification if they have turned those on), unless they already told the school. Correcting the mark sends a short correction. You can turn these alerts off at the top of this page.' : 'When you mark a student absent at today\'s register, their parents get an alert the same day, unless they already told the school. If you correct the mark, they get a short correction, so check the register before saving.',
      ],
    },
    {
      key: 'calendar', title: 'Calendar', for: 'all',
      tour: 'Term dates, school events and fixtures, month by month. You can add it to your phone\'s calendar.',
      steps: [
        'Move between months with the arrows. Tap a day to see just that day; the list below shows the whole month.',
        admin ? 'Choose "Add an event": give it a title, the kind (holiday, exams, trip and so on), the date or dates and, if it isn\'t all day, the times. Choose who sees it: everyone, chosen year groups, or staff only.' : 'Leadership, admins and the secretary add events. Term dates and club fixtures appear by themselves.',
        'Parents see the events for their children\'s year groups, term dates and their children\'s fixtures, never staff-only events.',
        'To see the calendar in your phone\'s calendar app, choose "Add to my phone\'s calendar" and Subscribe (or copy the link into Google Calendar or Outlook). Keep the link private.',
      ],
    },
    {
      key: 'clubs', title: 'Clubs', for: 'all',
      tour: 'Teams, clubs and societies: who is in them, registers, fixtures and results.',
      steps: [
        admin ? 'Choose "Add a club", give it a name, when and where it meets, and tick the staff who run it.' : 'Leadership or an admin adds each club and chooses the staff who run it.',
        'Open a club you run. On Members, type a student\'s name to add them; give someone a role such as captain.',
        'Register: choose the day, mark each member present, absent or excused, and save. The members list shows how often each one came.',
        'Fixtures and results: add a fixture (who against, when, home or away), pick the squad, and add the result afterwards as a score or in words, with a short report.',
        'Parents see their child\'s clubs, attendance, the fixtures they were picked for and the results. Every member of staff sees the clubs, fixtures and results.',
      ],
    },
    {
      key: 'boarding', title: 'Boarding', for: 'all',
      tour: 'Beds, roll calls, leave and the sick bay for boarders. Only house staff and admins see it.',
      steps: [
        admin ? 'Turn boarding on in Setup (Boarding: "Our school has boarders"). Then, on Boarding houses and beds, add the boarding houses, choose each house\'s staff, then add dormitories and beds.' : 'Your boarding houses are set up by an admin, who also makes you boarding house staff.',
        'Put a student in a bed by typing their name. Moving them to another bed frees the old one.',
        'Roll call: choose the house and morning, evening or night. Boarders on leave or in the sick bay are filled in; mark the rest present or missing and finish. Anyone missing shows on Today and your Home page until someone records them found (Found, on Today).',
        'Leave: parents ask in HouseMaster and you approve or decline (they get an email). Sign boarders out when they leave and back in when they return. You can also give leave yourself.',
        'Sick bay: check a boarder in with why they came and what was given, tell parents (email, or note that you phoned), and check them out when they leave.',
      ],
    },
    {
      key: 'announcements', title: 'Communications', for: 'all',
      tour: admin
        ? 'Announcements to parents or staff. Write them yourself or with Assisted Communications, and approve teachers\' drafts.'
        : `Announcements: send one to your ${cls}'s parents straight away, or draft one for the whole school for an admin to approve.`,
      steps: [
        `Choose who it's for: all parents, a year group, a ${cls}, or staff.`,
        'Write it yourself, or use Assisted Communications to draft it from a few notes.',
        admin ? 'Publish it. Parents are emailed and it appears in their app.'
          : `Notices to your own ${cls} go out straight away. Others go to an admin for approval.`,
      ],
    },
    {
      key: 'messages', title: 'Messages', for: 'all',
      tour: "Private conversations with parents, and class notices. You'll see a count when something new arrives.",
      steps: [
        'Start a conversation with a parent about their child, or post a notice to a whole class.',
        'Parents reply from their own app. Nobody sees anyone else\'s email or phone number.',
      ],
    },
    {
      key: 'alerts', title: 'Urgent alerts', for: 'all',
      tour: 'For emergencies only: a red banner every parent sees at once, with who has seen it.',
      steps: [
        'Write a short alert and choose who gets it. It shows as a banner until they confirm they\'ve seen it.',
        'You can also email it. End the alert when it no longer applies.',
      ],
    },
    {
      key: 'exports', title: 'Exports', for: 'all',
      tour: `Download ${cls} lists, marks and attendance as Excel, and report cards as PDFs.`,
      steps: [`Choose what to export and the ${cls} and ${term}, then download.`],
    },
    {
      key: 'approvals', title: admin ? 'Approvals' : 'My requests', for: 'all',
      tour: admin
        ? "Changes teachers have asked for (like a new subject), and parents' suggested health notes, wait here for you to approve or turn down."
        : "Some changes (like adding a subject) need an admin's approval. Follow your requests here.",
      steps: admin
        ? ['Approve or reject each request. Approved changes happen straight away.']
        : ['When a change needs approval, HouseMaster sends it to an admin for you and it appears here until they decide.'],
    },
    {
      key: 'setup', title: 'Setup', for: 'all',
      tour: admin
        ? `The school's details, ${w.year_groups.toLowerCase()}, ${classes}, ${subjects}, ${w.terms.toLowerCase()}, grading, and imports from Excel.`
        : `The school's ${classes}, ${subjects} and ${w.terms.toLowerCase()}. You can ask an admin to change them.`,
      steps: admin
        ? [`Add or rename ${classes}, ${subjects} and ${w.terms.toLowerCase()}; mark ${subjects} as electives.`,
          'Set assessment types and their weights, the grading scale and the report tone.',
          'Import students (and past marks) from Excel, add another curriculum, and move students up at year end.']
        : ['Changes you make here are sent to an admin for approval.'],
    },
    {
      key: 'staff', title: 'Staff', for: 'admin',
      tour: `Invite staff (one at a time or from Excel) and give each teacher their ${classes} and ${subjects}.`,
      steps: ['Invite someone by email, or import a spreadsheet of staff with what they teach.',
        `Assign ${classes} and ${subjects}: a teacher only sees the students in their own ${classes}.`,
        'Make someone an admin, or deactivate an account when they leave.',
        'Give extra roles under "Classes & roles": Leadership (the whole school), Head of Year, Class Teacher, Head of Department, Nurse, Secretary, Admissions Officer or Bursar (fees). One person can hold several.',
        'A Governor account is read-only: it sees the school\'s figures and never a named student.'],
    },
    {
      key: 'cover', title: 'Cover', for: 'admin',
      tour: 'When a teacher is away, record it here and choose who covers each of their lessons.',
      steps: ['Choose "Record an absence": who is away, the dates, and the whole day or only some lessons.',
        'Their lessons that day are listed. For each one, pick a member of staff who is free then (those with the lightest day come first), or mark it as supervised another way.',
        'The cover teacher sees the lesson, and your note, in "My day" on their Dashboard.',
        'Use the arrows to look at other days. Removing an absence also removes the cover arranged for it.'],
    },
    {
      key: 'sickbay', title: 'Sick bay', for: 'all',
      tour: 'For the school nurse: check any student into the sick bay, note what was given, and tell parents.',
      steps: ['Choose "Check a boarder in" and search for the student by name or admission number. Day students are included.',
        'Write why they came and what was given. Tick "Email parents" to send a short email; the details stay in HouseMaster.',
        'When they leave, choose where they went (back to lessons, home or to hospital) and check them out.'],
    },
    {
      key: 'parents', title: 'Parents', for: 'admin',
      tour: `Bring parents in with a sign-up link for each ${cls}, approve requests, and manage parent accounts.`,
      steps: [`Turn on a ${cls}'s sign-up link and share it (e.g. on WhatsApp). Parents sign up with their child's ${w.student_id.toLowerCase()}.`,
        'Approve each request: HouseMaster emails the parent their login.',
        'Or invite a parent directly. Edit contact details and which children a parent is linked to.'],
    },
    {
      key: 'admissions', title: 'Admissions', for: 'admin',
      tour: 'Applications for places: share your online form, then move each family from new to enrolled.',
      steps: [
        'Tick "Open for applications" and share the link on your website, by WhatsApp or by email. Families don\'t need an account.',
        'Choose which year groups take applications and write a short welcome for the top of the form.',
        'Open an application to read it, add staff notes (never sent) and move it on: reviewing, interview or test, offered, waiting list or not offered. Families get an email at each decision, with your note.',
        'When a place is offered or accepted, choose a class and Enrol: the child becomes a student and the parent is invited to HouseMaster.',
      ],
    },
    {
      key: 'activity', title: 'Activity log', for: 'admin',
      tour: 'A record of who did what and when, for accountability.',
      steps: ['Filter by person or type of action to see what changed.'],
    },
    {
      key: 'fees', title: 'Fees', for: 'admin',
      tour: 'School fees: charge each term, record payments, send receipts, and see who still owes.',
      steps: [
        'Admins and anyone with the Bursar role (given in Staff, under "Classes & roles") manage fees.',
        'In Settings, set the currency and how parents pay (e.g. your M-Pesa paybill). Parents see it, and it goes in reminders.',
        'In Fee structure, choose the term and add its fee items: tuition, boarding, lunch and so on, for every year group or one, and for everyone, boarders or day students. Then press "Bill this term". Billing again later only charges students who don\'t have an item yet, such as new students.',
        'In Balances, open a student to see their statement. "Record a payment" gives it the next receipt number and emails the receipt to the parents. "Add a discount or charge" is for bursaries, sibling discounts or extras like a lost book. A payment entered by mistake is cancelled with a reason, never deleted, so receipt numbers stay in order.',
        'Parents can say "We\'ve paid" with the M-Pesa code. These wait in To confirm: check each against your statement, then Confirm (records it and sends the receipt) or "Can\'t find it" with a reason the parent sees.',
        '"Email reminders" sends each family that owes their balance and how to pay (for one class, or the whole school).',
      ],
    },
    {
      key: 'billing', title: 'Billing', for: 'admin',
      tour: 'Your school\'s monthly subscription: its status, invoices and how to pay.',
      steps: [
        'You pay a monthly price for each active student. The top of the page shows the price and what it comes to for your school. Each invoice counts your active students on the day it\'s issued.',
        'Invoices are emailed to the school\'s admins a week before each month starts. Download any invoice as a PDF here.',
        'Pay using the details under "How to pay", with the invoice number as the reference. Then press "We\'ve paid" and give the payment\'s reference (e.g. the M-Pesa code). We check it and mark the invoice paid.',
        'If an invoice isn\'t paid by its due date, a grace period starts. After it, HouseMaster pauses for everyone at your school except admins, who can still open this page to pay. Paying unlocks it straight away once recorded.',
      ],
    },
    {
      key: 'profile', title: 'Profile', for: 'all',
      tour: 'Your name, password and privacy information.',
      steps: ['Change the name others see, and your password.'],
    },
  ]
  return sections.filter((s) => s.for === 'all' || s.for === role)
}

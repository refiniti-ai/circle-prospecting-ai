# AWS permissions needed — Circle Prospecting

**Account:** `381767547693`
**User to grant:** `tascreations.0207@gmail.com`
**Region we are working in:** US East (Ohio) `us-east-2`

We do **not** need the root login, the root password, or access keys.
Everything below is done by the account owner inside the AWS console.

---

## Why this is needed

Without these, the console blocks us with messages like:

- `not authorized to perform: cloudfront:ListDistributions`
- `not authorized to perform: route53:GetHostedZoneCount`

We can currently create S3 buckets and upload files, and read the database
settings. Nothing else.

---

## The fastest way to grant it (about 10 minutes)

Attaching more than 10 policies directly to a user hits an AWS limit, so put
them on a **group** instead.

### 1. Create the group

1. Console → **IAM** → **User groups** → **Create group**.
2. **Group name:** `CircleProspectingDeploy`
3. Under **Add users**, tick `tascreations.0207@gmail.com`.
4. Under **Attach permissions policies**, search for and tick each of these ten:

| # | Policy name | What it lets us do |
| --- | --- | --- |
| 1 | `AmazonS3FullAccess` | Hold the website files and set the bucket policy |
| 2 | `CloudFrontFullAccess` | Create the HTTPS address and the CDN |
| 3 | `AWSCertificateManagerFullAccess` | Issue the SSL certificate for the domain |
| 4 | `AmazonRoute53ReadOnlyAccess` | Check DNS. **Read only — cannot change anything** |
| 5 | `AmazonEC2ContainerRegistryFullAccess` | Store the API application image |
| 6 | `AWSAppRunnerFullAccess` | Run the API server |
| 7 | `AmazonVPCFullAccess` | Connect the API privately to your database |
| 8 | `SecretsManagerReadWrite` | Store passwords and keys securely, not in code |
| 9 | `CloudWatchLogsFullAccess` | Read error logs when something breaks |
| 10 | `AmazonRDSReadOnlyAccess` | Read database settings (**already granted**) |

5. **Create group**.

### 2. Add one inline policy to the same group

The group still needs permission to create the service roles that App Runner
requires. This is deliberately narrow — it can only touch roles whose name
starts with `circle-prospecting-`.

1. Open the `CircleProspectingDeploy` group → **Permissions** tab.
2. **Add permissions** → **Create inline policy** → **JSON** tab.
3. Replace everything in the box with the block below.
4. **Next** → **Policy name:** `CircleProspectingServiceRoles` → **Create policy**.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageProjectServiceRolesOnly",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:TagRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::381767547693:role/circle-prospecting-*",
        "arn:aws:iam::381767547693:role/ecsTaskExecutionRole"
      ]
    },
    {
      "Sid": "LetAwsCreateItsOwnServiceLinkedRoles",
      "Effect": "Allow",
      "Action": "iam:CreateServiceLinkedRole",
      "Resource": "*"
    },
    {
      "Sid": "ReadOnlySoConsolePagesLoad",
      "Effect": "Allow",
      "Action": [
        "iam:ListRoles",
        "iam:ListPolicies",
        "iam:GetPolicy",
        "iam:GetPolicyVersion"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Separate request — a read-only database user

This is **not** an AWS permission. It is a MySQL user created inside the
`new-production` database.

- Username: e.g. `circleprospecting_ro`
- Grant: **SELECT only** — no INSERT, UPDATE, DELETE, DROP
- Also tell us: **which database/schema** holds the listing data
- Send the password via a password manager (1Password, Bitwarden, etc.) —
  **not** email, chat, or a document

We will never use the `admin` master account from a web server.

---

## What we are **not** asking for

- The root account or its password
- Access keys emailed or pasted into chat
- Permission to change DNS. Route 53 is **read-only** in the list above.
  When it is time to point the live domain at the new site, we will send you
  the exact records and **you** make the change.
- Any permission to delete or modify the existing database

---

## Deliberately left out for now

| Policy | Why not yet |
| --- | --- |
| `AmazonECS_FullAccess` | Only needed if App Runner turns out not to fit. We will ask separately if so. |
| `AmazonRoute53FullAccess` | Only needed at go-live, and only if you want us to make the DNS change instead of doing it yourself. |

---

## One cost note

Because the database is correctly locked down (not reachable from the
internet), the API has to reach it through a private connection inside your
network. That needs a **NAT gateway**, roughly **$35/month**, on top of normal
hosting. There is a cheaper layout that avoids it but takes more setup time —
we will price both once access is in place.

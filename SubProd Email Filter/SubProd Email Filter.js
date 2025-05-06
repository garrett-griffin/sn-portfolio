/**
 * SubProd Email Filter v2.1
 * This code handles checking all outgoing emails for whom they're supposed to
 * send to and restricts it to only send to a specific group of people.
 *
 * This code is compatible with text notifications and with calendar invites.
 * This code is overridden by the glide.email.test.user property.
 *
 * Example Usage:
 * On a Dev instance, to have only developers get emails.
 *
 * Specifically:
 * This looks for the property "glide.email.test.group" and if it's populated,
 * it looks at all the recipients of the outbound emails and checks to see
 * if those email addresses or phone numbers belong to the members of the
 * group referenced by sys_id in the property.
 *
 * If the user that created the record the email is about happens to be in the
 * group, they will be added to the recipient list (to simplify testing).
 *
 * Note that in the code below:
 * allowedEmails = people the email is slated to go to
 * grpMembers = email addresses / phone numbers allowed to receive email.
 */

if (current.type !== "received") {
  subProdEmailFilter();
}

/**
 * Filters outgoing emails to only allow recipients from a specified group.
 * Uses the "glide.email.test.group" property to determine allowed recipients.
 * Handles both email addresses and phone numbers for notifications.
 * Adds warning text to the email body except for calendar invites.
 * Will include the record creator in recipients if they are in the allowed group.
 *
 * @returns {boolean} Returns true if email was processed and allowed recipients found,
 *                    false if filtering was skipped or no allowed recipients
 */
function subProdEmailFilter() {
  var table = current.target_table;
  var record = current.instance;
  var recipients = current.recipients;
  var bcc = current.blind_copied;
  var cc = current.copied;
  var body = current.body;
  var grpMembers = [];
  var allowedEmails = [];
  var allowedBCCs = [];
  var allowedCCs = [];
  var email = "";
  var phone = "";
  var lastUpdate = "";
  var groupName = "";

  // Grab the sys_id of the email group and verify it's a valid group.
  var testGroup = gs.getProperty("glide.email.test.group", "");

  // If the email is not turned on, then this should not run.
  if (testGroup === "") {
    return false;
  }

  // Validate that the group exists.
  var grp = new GlideRecord("sys_user_group");
  if (!grp.get("sys_id", testGroup)) {
    if (!grp.get("name", testGroup)) {
      // SubProd Email Group is not found, don't send any emails.
      current.type = "send-ignored";
      // eslint-disable-next-line servicenow/minimize-gs-log-print
      gs.log('Email Test Group "' + groupName + '" provided but does not match a valid group, so no email has been sent. Check property glide.email.test.group.');
      return false;
    }
    testGroup = grp.sys_id.toString(); // Sets the groups sys_id
  }

  // Look through all members of the test group, checking their email and phone.
  var grpMember = new GlideRecord("sys_user_grmember");
  grpMember.addQuery("group", testGroup);
  grpMember.query();
  var ndv;
  while (grpMember.next()) {
    // For each user, check their email
    email = grpMember.user.email.toString();
    if (recipients.indexOf(email) >= 0) {
      allowedEmails.push(grpMember.user.email.toString()); // Create an array of emails from the original recipients that are allowed to receive emails
    }
    if (bcc.indexOf(email) >= 0) {
      allowedBCCs.push(grpMember.user.email.toString()); // Create an array of emails from the original recipients that are allowed to receive emails
    }
    if (cc.indexOf(email) >= 0) {
      allowedCCs.push(grpMember.user.email.toString()); // Create an array of emails from the original recipients that are allowed to receive emails
    }
    grpMembers.push(grpMember.user.email.toString()); // Create an array of all test group members

    // Look up that member's notification devices and add those to the allowed list.
    ndv = new GlideRecord("cmn_notif_device");
    ndv.addQuery("user", grpMember.user);
    ndv.addQuery("email_address", "!=", email);
    ndv.query();
    while (ndv.next()) {
      if (ndv.type === "SMS") {
        phone = String(ndv.phone_number) + "@" + String(ndv.service_provider.email_suffix);
      } else {
        phone = String(ndv.email_address);
      }

      if (recipients.indexOf(phone) >= 0) {
        allowedEmails.push(phone); // Add the phone number to the allowed emails list.
      }
      if (bcc.indexOf(phone) >= 0) {
        allowedBCCs.push(phone); // Create an array of emails from the original recipients that are allowed to receive emails
      }
      if (cc.indexOf(phone) >= 0) {
        allowedCCs.push(phone); // Create an array of emails from the original recipients that are allowed to receive emails
      }
      grpMembers.push(phone); // Add the phone number to the group members list.
    }
  }

  // Look to see who last updated the referenced record.
  if (table) {
    var lastUpdatedGR = new GlideRecord(table);
    if (lastUpdatedGR.get(record)) {
      lastUpdate = lastUpdatedGR.sys_updated_by.toString();
    }
  }

  // Check to see if the last updated user is in the current allowedEmails array and add them if they are not and valid.
  // Only do this if there are no valid recipients.
  if (lastUpdate && !allowedEmails) {
    var usr = new GlideRecord("sys_user");
    usr.addQuery("user_name", lastUpdate);
    usr.addQuery("notification", 2); // Check to see if the user has the "notification" field set to "Email" which is 2.
    usr.query();
    if (usr.next()) {
      if (grpMembers.toString().indexOf(usr.email) >= 0) {
        // Are they a valid user?
        if (allowedEmails.toString().indexOf(usr.email) === -1) {
          // Are they already in the allowedEmails array?
          allowedEmails.push(usr.email.toString());
        }
      }
    }
  }

  // If the current recipients field is blank, then set the text to NONE.
  if (recipients === "") {
    recipients = "NONE";
  }

  // DO NOT APPEND anything if this is a calendar invite. It will mess it up if you do.
  if (body.indexOf("END:VCALENDAR") < 0) {
    current.body = '<div style="color: red; font-size: 30px; font-weight: bold; width: 100%; text-align: center;"><br />TEST EMAIL - TAKE NO ACTION<br />&nbsp;</div>' + body;
    current.body = body + '<div><br/><br/><hr/></div><div>TESTING MODE ENABLED - EMAIL MAY NOT HAVE BEEN INTENDED FOR YOU:<br /><div style="padding-left:25px;">Intended TO Field: ' + recipients + "<br />Intended CC Field: " + cc + "<br />Intended BCC Field: " + bcc + "</div></div><br/>";
  }

  // If there are no alowed recipients then set the email to send-ignored and clear the recipient field.
  if (allowedEmails.length === 0) {
    current.type = "send-ignored";
    current.recipients = "";
  } else {
    current.recipients = allowedEmails.toString();
    current.blind_copied = allowedBCCs.toString();
    current.copied = allowedCCs.toString();
  }
  return true;
}

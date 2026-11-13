export function isBusinessSubscriptionActive(subscription) {
  if (subscription?.plan !== "business") {
    return false;
  }

  if (subscription.status === "active") {
    // Preserve existing Business members without an expiry date.
    if (!subscription.expires_at) {
      return true;
    }

    const expiry = new Date(subscription.expires_at);

    return (
      !Number.isNaN(expiry.getTime()) &&
      expiry.getTime() > Date.now()
    );
  }

  if (subscription.status === "trialing") {
    if (!subscription.trial_ends_at) {
      return false;
    }

    const trialEnd = new Date(subscription.trial_ends_at);

    return (
      !Number.isNaN(trialEnd.getTime()) &&
      trialEnd.getTime() > Date.now()
    );
  }

  return false;
}

//! Cloudflare DNS API integration for adding a multiaddr to a TXT record.
//!
//! Creates a separate TXT record for up to 4 multiaddrs, then overwrites older records with newer ones.
//!
//! Cloudflare [cloudflare::endpoints::dns::DnsRecord] provides a unique descriptions for specific records, so we use
//! comments to insert a timestamp for each record. This is used to determine which records to keep
//! and which to remove.
use cloudflare::endpoints::dns::{
    CreateDnsRecord, DeleteDnsRecord, DnsContent, DnsRecord, ListDnsRecords, ListDnsRecordsParams,
};
use cloudflare::framework::response::ApiFailure;
use cloudflare::framework::{async_api::Client, auth::Credentials, Environment};
use cloudflare::framework::{HttpApiClientConfig, OrderDirection};
use libp2p::Multiaddr;
use std::env;

/// The maximum number of TXT records to keep in Cloudflare
const MAX_RECORDS: usize = 2;

/// Cloudflare DNS Errors
#[derive(Debug, thiserror::Error)]
pub enum CloudflareError {
    /// Environment Variable not found. Do you have a .env file?
    #[error("Env Var not found for {msg}. Do you have a .env file?")]
    EnvVarNotFound {
        msg: String,
        #[source]
        source: env::VarError,
    },
    /// Cloudflare API Error
    #[error("Cloudflare API Error: {0}")]
    ApiError(#[from] cloudflare::framework::Error),
    /// API Failure
    #[error("API Failure: {0}")]
    ApiFailure(#[from] ApiFailure),
}

/// Add a multiaddr to a TXT record in Cloudflare. removes older records if there are more than [MAX_RECORDS]
pub async fn add_address(multiaddr: &Multiaddr) -> Result<(), CloudflareError> {
    // use this workspace member's folder .env
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    tracing::debug!("Loading environment variables from {:?}", path);
    dotenv::from_path(path).ok();

    let [api_token, zone_id, txt_name]: [String; 3] = ["CF_API_TOKEN", "CF_ZONE_ID", "CF_TXT_NAME"]
        .iter()
        .map(|var| {
            env::var(var).map_err(|e| CloudflareError::EnvVarNotFound {
                msg: var.to_string(),
                source: e,
            })
        })
        .collect::<Result<Vec<String>, CloudflareError>>()?
        .try_into()
        .map_err(|e| CloudflareError::EnvVarNotFound {
            msg: format!("Not enough environment variables found: {:?}", e).to_string(),
            source: env::VarError::NotPresent,
        })?;

    let credentials = Credentials::UserAuthToken { token: api_token };
    let api_client = Client::new(
        credentials,
        HttpApiClientConfig::default(),
        Environment::Production,
    )
    .map_err(|e| {
        tracing::error!("❌ Error creating Cloudflare API client: {:?}", e);
        CloudflareError::ApiError(e)
    })?;

    let mut existing_records = api_client
        .request(&ListDnsRecords {
            zone_identifier: &zone_id,
            params: ListDnsRecordsParams {
                direction: Some(OrderDirection::Descending),
                name: Some(txt_name.clone()),
                page: Some(1),
                per_page: Some(100),
                ..Default::default()
            },
        })
        .await
        .map_err(|e| {
            tracing::error!("❌ Error listing DNS records: {:?}", e);
            CloudflareError::ApiFailure(e)
        })?
        .result;

    existing_records.sort_by(|a, b| a.created_on.cmp(&b.created_on).reverse());

    // check to see if the multiaddr is already in an existing record, if so, return
    if existing_records.iter().any(|record| {
        if let DnsContent::TXT { content } = &record.content {
            content.contains(&multiaddr.to_string())
        } else {
            false
        }
    }) {
        tracing::info!("🔍 Multiaddr already exists in TXT record");
        return Ok(());
    }

    // Create new record
    // turn the addr into a dnsaddr
    let content = format!("dnsaddr={}", multiaddr);
    api_client
        .request(&CreateDnsRecord {
            zone_identifier: &zone_id,
            params: cloudflare::endpoints::dns::CreateDnsRecordParams {
                ttl: None,
                priority: None,
                proxied: None,
                name: &txt_name,
                content: DnsContent::TXT {
                    content: content.to_string(),
                },
            },
        })
        .await?;
    tracing::info!("🆕 TXT record created successfully {:?}", content);

    // if num <= MAX_RECORDS, return
    if existing_records.len() <= MAX_RECORDS {
        tracing::info!(
            "📦 TXT records within limit (found {})",
            existing_records.len()
        );
        return Ok(());
    }

    tracing::info!(
        "🗑 Deleting old TXT records ({} > {})",
        existing_records.len(),
        MAX_RECORDS
    );

    // Delete all but most recent MAX_RECORDS
    for record in existing_records.iter().skip(MAX_RECORDS) {
        api_client
            .request(&DeleteDnsRecord {
                zone_identifier: &zone_id,
                identifier: &record.id,
            })
            .await?;
        tracing::info!(
            "🗑 Deleted old TXT record [{}]: {:?}",
            record.created_on.to_string(),
            record.id
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use libp2p::{multiaddr::Protocol, Multiaddr};
    use std::net::Ipv6Addr;

    //use super::*;

    #[tokio::test]
    async fn test_add_address() {
        // Create a multiaddr

        let address_webrtc = Multiaddr::from(Ipv6Addr::UNSPECIFIED)
            .with(Protocol::Udp(0))
            .with(Protocol::WebRTCDirect);

        assert_eq!(
            address_webrtc.to_string(),
            "/ip6/::/udp/0/webrtc-direct".to_string()
        );

        // NOTE: This is commented out because it posts to Cloudflare in production,
        // and we don't want to do that in tests.

        // let res = add_address(&address_webrtc).await;

        // ensure test outputs the printed res
        // println!("{:?}", res);
    }
}

use cloudflare::endpoints::dns::{
    CreateDnsRecord, DnsContent, ListDnsRecords, ListDnsRecordsParams, UpdateDnsRecord,
};
use cloudflare::framework::HttpApiClientConfig;
use cloudflare::framework::{async_api::Client, auth::Credentials, Environment};
use libp2p::Multiaddr;
use std::env;

pub async fn add_address(multiaddr: &Multiaddr) -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();

    let api_token = env::var("CF_API_TOKEN")?;
    let zone_id = env::var("CF_ZONE_ID")?;
    let txt_name = env::var("CF_TXT_NAME")?;

    let credentials = Credentials::UserAuthToken { token: api_token };
    let api_client = Client::new(
        credentials,
        HttpApiClientConfig::default(),
        Environment::Production,
    )?;

    let dns_records = api_client
        .request(&ListDnsRecords {
            zone_identifier: &zone_id,
            params: ListDnsRecordsParams {
                name: Some(txt_name.clone()),
                ..Default::default()
            },
        })
        .await?;

    let existing_record = dns_records
        .result
        .iter()
        .find(|record| record.name == txt_name && matches!(record.content, DnsContent::TXT { .. }));

    println!("Existing record: {:?}", existing_record);

    if let Some(record) = existing_record {
        // Update existing record by adding the multiaddr. Create new content by extending existing content. Use "," as delimiter.
        let content = match &record.content {
            DnsContent::TXT { content } => {
                // split on '," and new lines / carriage returns'
                let mut content = content
                    .split(',')
                    .flat_map(|s| s.split('\n'))
                    .flat_map(|s| s.split('\r'))
                    .filter(|s| !s.is_empty())
                    .filter(|s| !s.starts_with("dnsaddr="))
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>();
                content.push(format!("dnsaddr={}", multiaddr.to_string()));
                content.join(",")
            }
            _ => {
                return Err("Existing record is not a TXT record".into());
            }
        };
        api_client
            .request(&UpdateDnsRecord {
                zone_identifier: &zone_id,
                identifier: &record.id,
                params: cloudflare::endpoints::dns::UpdateDnsRecordParams {
                    ttl: None,
                    proxied: None,
                    name: &txt_name,
                    content: DnsContent::TXT {
                        content: format!("dnsaddr={}", multiaddr.to_string()),
                    },
                },
            })
            .await?;
        println!("TXT record updated successfully");
    } else {
        // Create new record
        // turn the addr into a dnsaddr
        let content = format!("dnsaddr={}", multiaddr.to_string());
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
        println!("TXT record created successfully");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use libp2p::{multiaddr::Protocol, Multiaddr};
    use std::net::Ipv6Addr;

    use super::*;

    #[tokio::test]
    async fn test_add_address() {
        // Create a multiaddr

        let address_webrtc = Multiaddr::from(Ipv6Addr::UNSPECIFIED)
            .with(Protocol::Udp(0))
            .with(Protocol::WebRTCDirect);

        // let res = add_address(&address_webrtc).await;

        // ensure test outputs the printed res
        // println!("{:?}", res);
    }
}

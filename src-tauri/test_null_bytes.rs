use std::sync::Arc;
use crate::search::{SearchService, QueryParser};
use crate::database::DbService;
use tempfile::NamedTempFile;

#[tokio::test]
async fn test_null_bytes_sigbus() {
    let temp_file = NamedTempFile::new().unwrap();
    let db_service = Arc::new(DbService::new(temp_file.path()).unwrap());
    let search_service = SearchService::new(db_service.clone());
    
    // Create a test note
    let _ = db_service.create_note("Test content for search".to_string()).await.unwrap();
    
    // Test queries with null bytes that should cause SIGBUS
    let null_byte_queries = vec![
        "test\0query",
        "search\0\0content", 
        "\0malicious\0query\0",
        "normal AND \0injection",
        "\0\0\0\0",
    ];
    
    for query in null_byte_queries {
        println!("Testing query with null bytes: {:?}", query.as_bytes());
        
        // This should cause SIGBUS if null bytes aren't handled properly
        let result = search_service.search_notes_paginated(query, 0, 10).await;
        println!("Result: {:?}", result);
        
        let boolean_result = search_service.search_notes_boolean_paginated(query, 0, 10).await;
        println!("Boolean result: {:?}", boolean_result);
    }
}
